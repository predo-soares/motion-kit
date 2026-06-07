import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Framework } from "../config/types.js";

/**
 * Check if a dependency is installed in the project
 */
async function hasDependency(cwd: string, depName: string): Promise<boolean> {
  try {
    const pkgPath = join(cwd, "package.json");
    const pkgContent = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);

    return (
      (pkg.dependencies && pkg.dependencies[depName]) ||
      (pkg.devDependencies && pkg.devDependencies[depName]) ||
      false
    );
  } catch {
    return false;
  }
}

/**
 * Check if a config file exists
 */
function hasConfigFile(cwd: string, fileName: string): boolean {
  return existsSync(join(cwd, fileName));
}

/**
 * Detect the framework from dependencies and config files
 * Priority order: Nuxt > Next > Astro > SvelteKit > Vue > React > Svelte > plain
 */
export async function detectFramework(cwd: string): Promise<Framework> {
  // Check for Nuxt (has priority over Vue)
  if (
    (await hasDependency(cwd, "nuxt")) ||
    hasConfigFile(cwd, "nuxt.config.ts") ||
    hasConfigFile(cwd, "nuxt.config.js")
  ) {
    return "nuxt";
  }

  // Check for Next.js
  if (await hasDependency(cwd, "next")) {
    return "next";
  }

  // Check for Astro
  if (
    (await hasDependency(cwd, "astro")) ||
    hasConfigFile(cwd, "astro.config.mjs") ||
    hasConfigFile(cwd, "astro.config.ts")
  ) {
    return "astro";
  }

  // Check for SvelteKit
  if (
    (await hasDependency(cwd, "@sveltejs/kit")) ||
    hasConfigFile(cwd, "svelte.config.js")
  ) {
    return "sveltekit";
  }

  // Check for Vue (plain Vite + Vue, not Nuxt)
  if (await hasDependency(cwd, "vue")) {
    return "vue";
  }

  // Check for React (plain Vite + React)
  if (
    (await hasDependency(cwd, "react")) ||
    (await hasDependency(cwd, "react-dom"))
  ) {
    return "react";
  }

  // Check for Svelte (plain, not SvelteKit)
  if (await hasDependency(cwd, "svelte")) {
    return "svelte";
  }

  // Default to plain
  return "plain";
}

/**
 * Get default directories for a framework
 */
export function getDefaultDirectories(framework: Framework): {
  componentsDir: string;
  helpersDir: string;
} {
  switch (framework) {
    case "astro":
      return {
        componentsDir: "src/components/motion-kit",
        helpersDir: "src/lib/motion-kit",
      };
    case "next":
    case "react":
      return {
        componentsDir: "src/components/motion-kit",
        helpersDir: "src/lib/motion-kit",
      };
    case "vue":
    case "nuxt":
      return {
        componentsDir: "src/components/motion-kit",
        helpersDir: "src/utils/motion-kit",
      };
    case "svelte":
    case "sveltekit":
      return {
        componentsDir: "src/lib/components/motion-kit",
        helpersDir: "src/lib/motion-kit",
      };
    case "plain":
    default:
      return {
        componentsDir: "src/components/motion-kit",
        helpersDir: "src/lib/motion-kit",
      };
  }
}
