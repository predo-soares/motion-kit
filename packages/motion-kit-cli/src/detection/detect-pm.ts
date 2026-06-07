import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PackageManager } from "../config/types.js";

/**
 * Detect package manager from lockfiles in the current directory or parent directories
 */
export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  const checkDir = async (dir: string): Promise<PackageManager | null> => {
    // Check for lockfiles in priority order
    if (existsSync(join(dir, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(dir, "package-lock.json"))) {
      return "npm";
    }
    if (existsSync(join(dir, "yarn.lock"))) {
      return "yarn";
    }
    if (existsSync(join(dir, "bun.lockb"))) {
      return "bun";
    }

    // Check parent directory until we reach root
    const parentDir = dirname(dir);
    if (parentDir === dir) {
      // Reached root
      return null;
    }

    return checkDir(parentDir);
  };

  const detected = await checkDir(cwd);
  if (!detected) {
    // Default to npm if no lockfile found
    return "npm";
  }

  return detected;
}

/**
 * Get the install command for a package manager
 */
export function getInstallCommand(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn";
    case "bun":
      return "bun install";
    case "npm":
    default:
      return "npm install";
  }
}

/**
 * Get the add command for a package manager
 */
export function getAddCommand(pm: PackageManager, packageName: string, flags: string[] = []): string {
  const flagStr = flags.length > 0 ? " " + flags.join(" ") : "";
  switch (pm) {
    case "pnpm":
      return `pnpm add ${packageName}${flagStr}`;
    case "yarn":
      return `yarn add ${packageName}${flagStr}`;
    case "bun":
      return `bun add ${packageName}${flagStr}`;
    case "npm":
    default:
      return `npm install ${packageName}${flagStr}`;
  }
}
