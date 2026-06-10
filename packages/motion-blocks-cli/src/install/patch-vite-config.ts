import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { Logger } from "../utils/logger.js";
import { findMatchingDelimiter } from "../utils/delimiters.js";

const MOTION_KIT_OPTIMIZE_DEPS = ["lit", "gsap"] as const;
const REACT_COMPILER_INCLUDE = String.raw`/\.[jt]sx$/`;

export interface PatchViteConfigOptions {
  cwd: string;
  dryRun: boolean;
  logger: Logger;
  confirm?: (description: string) => Promise<boolean>;
}

export interface PatchViteConfigResult {
  patched: boolean;
  path?: string;
  skippedReason?: "already configured" | "no vite config found" | "user skipped";
}

function includesAllDeps(includeSource: string, deps: readonly string[]): boolean {
  return deps.every((dep) => new RegExp(`['"]${dep}['"]`).test(includeSource));
}

function mergeDepsIntoInclude(includeSource: string, deps: readonly string[]): string {
  let next = includeSource.trim();
  const missing = deps.filter((dep) => !new RegExp(`['"]${dep}['"]`).test(next));

  if (missing.length === 0) {
    return includeSource;
  }

  if (next.length > 0 && !next.endsWith(",")) {
    next += ", ";
  } else if (next.length > 0) {
    next += " ";
  }

  next += missing.map((dep) => `'${dep}'`).join(", ");
  return next;
}

export function patchViteOptimizeDeps(content: string): { content: string; changed: boolean } {
  const optimizeDepsMatch = content.match(
    /optimizeDeps\s*:\s*\{[\s\S]*?include\s*:\s*\[([\s\S]*?)\]/,
  );

  if (optimizeDepsMatch) {
    const includeSource = optimizeDepsMatch[1] ?? "";
    if (includesAllDeps(includeSource, MOTION_KIT_OPTIMIZE_DEPS)) {
      return { content, changed: false };
    }

    const mergedInclude = mergeDepsIntoInclude(includeSource, MOTION_KIT_OPTIMIZE_DEPS);
    return {
      content: content.replace(optimizeDepsMatch[0], optimizeDepsMatch[0].replace(includeSource, mergedInclude)),
      changed: true,
    };
  }

  if (!/defineConfig\s*\(\s*\{/.test(content)) {
    return { content, changed: false };
  }

  if (/optimizeDeps\s*:/.test(content)) {
    return { content, changed: false };
  }

  const block = `  optimizeDeps: {
    include: ['lit', 'gsap']
  },
`;

  const closingMatch = content.match(/\n}\)\s*$/);
  if (!closingMatch) {
    return { content, changed: false };
  }

  const closingIndex = closingMatch.index!;
  return {
    content: `${content.slice(0, closingIndex)}\n${block}${content.slice(closingIndex + 1)}`,
    changed: true,
  };
}

function findCallClose(content: string, openParenIndex: number): number {
  return findMatchingDelimiter(content, openParenIndex, "(", ")");
}

function insertReactCompilerInclude(args: string): { args: string; changed: boolean } {
  if (!/reactCompilerPreset\s*\(/.test(args) || /\binclude\s*:/.test(args)) {
    return { args, changed: false };
  }

  const closeBraceIndex = args.lastIndexOf("}");
  if (!args.trimStart().startsWith("{") || closeBraceIndex === -1) {
    return { args, changed: false };
  }

  const beforeClose = args.slice(0, closeBraceIndex);
  const afterClose = args.slice(closeBraceIndex);
  const trailing = beforeClose.trimEnd();
  const needsComma = trailing.length > 0 && !trailing.endsWith("{") && !trailing.endsWith(",");

  if (!args.includes("\n")) {
    const compactBeforeClose = beforeClose.trimEnd();
    return {
      args: `${compactBeforeClose}${needsComma ? ", " : " "}include: ${REACT_COMPILER_INCLUDE}${afterClose}`,
      changed: true,
    };
  }

  const closeLineStart = args.lastIndexOf("\n", closeBraceIndex) + 1;
  const closeIndent = args.slice(closeLineStart, closeBraceIndex).match(/^\s*/)?.[0] ?? "";
  const propertyIndent = `${closeIndent}  `;

  return {
    args: `${beforeClose}${needsComma ? "," : ""}\n${propertyIndent}include: ${REACT_COMPILER_INCLUDE}${afterClose}`,
    changed: true,
  };
}

export function patchViteReactCompilerBabelInclude(content: string): { content: string; changed: boolean } {
  let next = content;
  let changed = false;
  let searchFrom = 0;

  while (searchFrom < next.length) {
    const callMatch = /\bbabel\s*\(/.exec(next.slice(searchFrom));
    if (!callMatch) {
      break;
    }

    const callStart = searchFrom + callMatch.index;
    const openParenIndex = next.indexOf("(", callStart);
    const closeParenIndex = findCallClose(next, openParenIndex);
    if (closeParenIndex === -1) {
      break;
    }

    const argsStart = openParenIndex + 1;
    const args = next.slice(argsStart, closeParenIndex);
    const patched = insertReactCompilerInclude(args);

    if (patched.changed) {
      next = `${next.slice(0, argsStart)}${patched.args}${next.slice(closeParenIndex)}`;
      changed = true;
      searchFrom = argsStart + patched.args.length;
      continue;
    }

    searchFrom = closeParenIndex + 1;
  }

  return { content: next, changed };
}

async function resolveViteConfigPath(cwd: string): Promise<string | null> {
  for (const name of ["vite.config.ts", "vite.config.mjs", "vite.config.js"]) {
    const path = join(cwd, name);
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

export async function ensureViteOptimizeDeps(
  options: PatchViteConfigOptions,
): Promise<PatchViteConfigResult> {
  const viteConfigPath = await resolveViteConfigPath(options.cwd);
  if (!viteConfigPath) {
    options.logger.warn(
      "could not find vite.config.ts — add optimizeDeps.include: ['lit', 'gsap'] manually",
    );
    return { patched: false, skippedReason: "no vite config found" };
  }

  const content = await readFile(viteConfigPath, "utf-8");
  const optimizeDepsPatch = patchViteOptimizeDeps(content);
  const babelIncludePatch = patchViteReactCompilerBabelInclude(optimizeDepsPatch.content);
  const nextContent = babelIncludePatch.content;
  const changed = optimizeDepsPatch.changed || babelIncludePatch.changed;

  if (!changed) {
    return {
      patched: false,
      path: relative(options.cwd, viteConfigPath) || viteConfigPath,
      skippedReason: "already configured",
    };
  }

  const label = relative(options.cwd, viteConfigPath) || viteConfigPath;

  if (options.dryRun) {
    if (optimizeDepsPatch.changed) {
      options.logger.info(`would add optimizeDeps.include: ['lit', 'gsap'] to ${label}`);
    }
    if (babelIncludePatch.changed) {
      options.logger.info(`would restrict React Compiler Babel plugin to JSX files in ${label}`);
    }
    return { patched: true, path: label };
  }

  if (options.confirm) {
    const parts: string[] = [];
    if (optimizeDepsPatch.changed) parts.push(`Add optimizeDeps.include: ['lit', 'gsap']`);
    if (babelIncludePatch.changed) parts.push(`Scope React Compiler Babel plugin to JSX files`);
    const canPrompt = Boolean(process.stdin.isTTY);
    const accepted = canPrompt ? await options.confirm(`${parts.join(" + ")} in ${label}`) : false;
    if (!accepted) {
      const manualStep = `  optimizeDeps: {\n    include: ['lit', 'gsap']\n  },`;
      options.logger.info(`skipped — add this to ${label} manually:\n${manualStep}`);
      return { patched: false, skippedReason: "user skipped" };
    }
  }

  await writeFile(viteConfigPath, nextContent, "utf-8");
  if (optimizeDepsPatch.changed) {
    options.logger.info(`added optimizeDeps.include: ['lit', 'gsap'] to ${label}`);
  }
  if (babelIncludePatch.changed) {
    options.logger.info(`restricted React Compiler Babel plugin to JSX files in ${label}`);
  }
  return { patched: true, path: label };
}
