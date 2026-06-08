import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { Logger } from "../utils/logger.js";

const MOTION_KIT_OPTIMIZE_DEPS = ["lit", "gsap"] as const;

export interface PatchViteConfigOptions {
  cwd: string;
  dryRun: boolean;
  logger: Logger;
}

export interface PatchViteConfigResult {
  patched: boolean;
  path?: string;
  skippedReason?: string;
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
  if (!closingMatch?.index) {
    return { content, changed: false };
  }

  return {
    content: `${content.slice(0, closingMatch.index)}\n${block}${content.slice(closingMatch.index + 1)}`,
    changed: true,
  };
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
  const { content: nextContent, changed } = patchViteOptimizeDeps(content);

  if (!changed) {
    return {
      patched: false,
      path: relative(options.cwd, viteConfigPath) || viteConfigPath,
      skippedReason: "already configured",
    };
  }

  const label = relative(options.cwd, viteConfigPath) || viteConfigPath;

  if (options.dryRun) {
    options.logger.info(`would add optimizeDeps.include: ['lit', 'gsap'] to ${label}`);
    return { patched: true, path: label };
  }

  await writeFile(viteConfigPath, nextContent, "utf-8");
  options.logger.info(`added optimizeDeps.include: ['lit', 'gsap'] to ${label}`);
  return { patched: true, path: label };
}
