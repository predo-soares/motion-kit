import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import type { Framework } from "../config/types.js";
import type { Logger } from "../utils/logger.js";

export interface PatchTsConfigOptions {
  cwd: string;
  framework?: Framework;
  dryRun: boolean;
  logger: Logger;
  confirm?: (description: string) => Promise<boolean>;
}

export interface PatchTsConfigResult {
  patched: boolean;
  path?: string;
  skippedReason?: "already enabled" | "no tsconfig found" | "no nuxt config file found" | "user skipped";
}

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function parseJsonc(text: string): Record<string, unknown> {
  const withoutComments = stripJsonComments(text).replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(withoutComments) as Record<string, unknown>;
}

function hasExperimentalDecoratorsEnabled(content: string): boolean {
  return /["']experimentalDecorators["']\s*:\s*true/.test(content);
}

function patchCompilerOptionsBlock(content: string): { content: string; changed: boolean } {
  if (hasExperimentalDecoratorsEnabled(content)) {
    return { content, changed: false };
  }

  const disabled = content.match(/(["']experimentalDecorators["']\s*:\s*)false/);
  if (disabled) {
    return {
      content: content.replace(/(["']experimentalDecorators["']\s*:\s*)false/, "$1true"),
      changed: true,
    };
  }

  const compilerOptionsMatch = content.match(/["']compilerOptions["']\s*:\s*\{/);
  if (compilerOptionsMatch?.index !== undefined) {
    const insertPos = compilerOptionsMatch.index + compilerOptionsMatch[0].length;
    const lineStart = content.lastIndexOf("\n", insertPos) + 1;
    const indent = content.slice(lineStart, insertPos).match(/^\s*/)?.[0] ?? "";
    const propertyIndent = `${indent}  `;
    const injection = `\n${propertyIndent}"experimentalDecorators": true,`;
    return {
      content: content.slice(0, insertPos) + injection + content.slice(insertPos),
      changed: true,
    };
  }

  const rootOpen = content.match(/^\s*\{/);
  if (rootOpen?.index === undefined) {
    return { content, changed: false };
  }

  const insertPos = rootOpen.index + rootOpen[0].length;
  const injection = `\n  "compilerOptions": {\n    "experimentalDecorators": true\n  },`;
  return {
    content: content.slice(0, insertPos) + injection + content.slice(insertPos),
    changed: true,
  };
}

function hasCompilerOptionsBlock(content: string): boolean {
  return /["']compilerOptions["']\s*:\s*\{/.test(content);
}

async function resolveTsConfigPath(cwd: string): Promise<string | null> {
  const candidates = ["tsconfig.app.json", "tsconfig.json"];

  for (const name of candidates) {
    const path = join(cwd, name);
    if (!existsSync(path)) {
      continue;
    }

    const content = await readFile(path, "utf-8");
    if (hasCompilerOptionsBlock(content)) {
      return path;
    }

    if (name === "tsconfig.json") {
      const referenceMatch = content.match(/["']path["']\s*:\s*["']([^"']*app[^"']*)["']/);
      if (referenceMatch?.[1]) {
        const refPath = resolve(cwd, referenceMatch[1]);
        if (existsSync(refPath)) {
          const refContent = await readFile(refPath, "utf-8");
          if (hasCompilerOptionsBlock(refContent)) {
            return refPath;
          }
        }
      }
    }
  }

  return null;
}

async function patchTsConfigFile(
  path: string,
  options: Pick<PatchTsConfigOptions, "cwd" | "dryRun" | "logger" | "confirm">,
): Promise<PatchTsConfigResult> {
  const content = await readFile(path, "utf-8");
  const { content: nextContent, changed } = patchCompilerOptionsBlock(content);

  if (!changed) {
    return { patched: false, path, skippedReason: "already enabled" };
  }

  const label = relative(options.cwd, path) || path;

  if (options.dryRun) {
    options.logger.info(
      `would set compilerOptions.experimentalDecorators: true in ${label}`,
    );
    return { patched: true, path: label };
  }

  if (options.confirm) {
    const description = `Add compilerOptions.experimentalDecorators: true to ${label}`;
    const accepted = await options.confirm(description);

    if (!accepted) {
      options.logger.info(
        `skipped — add this to ${label} manually:\n  "experimentalDecorators": true`,
      );
      return { patched: false, skippedReason: "user skipped" };
    }
  }

  await writeFile(path, nextContent, "utf-8");
  options.logger.info(`set compilerOptions.experimentalDecorators: true in ${label}`);
  return { patched: true, path: label };
}

function patchNuxtConfigContent(content: string): { content: string; changed: boolean } {
  if (/experimentalDecorators\s*:\s*true/.test(content)) {
    return { content, changed: false };
  }

  if (!/defineNuxtConfig\s*\(\s*\{/.test(content)) {
    return { content, changed: false };
  }

  const injection = `
  typescript: {
    tsConfig: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },`;

  return {
    content: content.replace(/defineNuxtConfig\s*\(\s*\{/, `defineNuxtConfig({${injection}`),
    changed: true,
  };
}

async function patchNuxtConfig(
  cwd: string,
  options: Pick<PatchTsConfigOptions, "dryRun" | "logger" | "confirm">,
): Promise<PatchTsConfigResult> {
  const candidates = ["nuxt.config.ts", "nuxt.config.mjs", "nuxt.config.js"];

  for (const name of candidates) {
    const path = join(cwd, name);
    if (!existsSync(path)) {
      continue;
    }

    const content = await readFile(path, "utf-8");
    const { content: nextContent, changed } = patchNuxtConfigContent(content);

    if (!changed) {
      return { patched: false, path, skippedReason: "already enabled" };
    }

    if (options.dryRun) {
      options.logger.info(
        `would set typescript.tsConfig.compilerOptions.experimentalDecorators: true in ${name}`,
      );
      return { patched: true, path: name };
    }

    if (options.confirm) {
      const description = `Add typescript.tsConfig.compilerOptions.experimentalDecorators: true to ${name}`;
      const manualStep = `  typescript: {\n    tsConfig: {\n      compilerOptions: {\n        experimentalDecorators: true,\n      },\n    },\n  },`;
      const accepted = await options.confirm(description);

      if (!accepted) {
        options.logger.info(
          `skipped — add this to ${name} manually:\n${manualStep}`,
        );
        return { patched: false, skippedReason: "user skipped" };
      }
    }

    await writeFile(path, nextContent, "utf-8");
    options.logger.info(
      `set typescript.tsConfig.compilerOptions.experimentalDecorators: true in ${name}`,
    );
    return { patched: true, path: name };
  }

  return { patched: false, skippedReason: "no nuxt config file found" };
}

export async function ensureExperimentalDecorators(
  options: PatchTsConfigOptions,
): Promise<PatchTsConfigResult> {
  if (options.framework === "nuxt") {
    const nuxtResult = await patchNuxtConfig(options.cwd, options);
    if (
      nuxtResult.patched ||
      nuxtResult.skippedReason === "already enabled" ||
      nuxtResult.skippedReason === "user skipped"
    ) {
      return nuxtResult;
    }
  }

  const tsConfigPath = await resolveTsConfigPath(options.cwd);
  if (!tsConfigPath) {
    options.logger.warn(
      "could not find a TypeScript config to patch — add compilerOptions.experimentalDecorators: true manually",
    );
    return { patched: false, skippedReason: "no tsconfig found" };
  }

  return patchTsConfigFile(tsConfigPath, options);
}
