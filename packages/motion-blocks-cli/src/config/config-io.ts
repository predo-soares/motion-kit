import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MotionBlocksConfig } from "./types.js";
import { validateConfig } from "./validate-config.js";
import { MotionBlocksError } from "../utils/errors.js";

const CONFIG_FILENAME = "motion-blocks.json";

/**
 * Get the path to the config file
 */
export function getConfigPath(cwd: string): string {
  return join(cwd, CONFIG_FILENAME);
}

/**
 * Read the motion-blocks.json config file if it exists
 */
export async function readConfig(cwd: string): Promise<MotionBlocksConfig | null> {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return validateConfig(JSON.parse(content), configPath);
  } catch (error) {
    if (error instanceof MotionBlocksError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new MotionBlocksError(
      `Failed to read or parse motion-blocks.json at ${configPath}: ${message}\n\nNext: Fix the JSON syntax or run \`motion-blocks init --overwrite\` to recreate the config.`,
      "invalid_config",
    );
  }
}

export type WriteConfigOptions = {
  overwrite?: boolean;
  dryRun?: boolean;
  /**
   * Optional callback invoked when the config file already exists and
   * `--overwrite` is not set. Receives a human-readable description of the
   * proposed change and should return `true` to proceed with writing or
   * `false` to skip. When omitted, the legacy throw-on-exists behaviour is
   * preserved for backwards compatibility.
   */
  confirm?: (diff: string) => Promise<boolean>;
};

/**
 * Write the motion-blocks.json config file with overwrite protection.
 *
 * Behaviour matrix:
 * - No existing file            → always writes (no prompt)
 * - Existing + --overwrite      → writes without prompting
 * - Existing + confirm callback → calls confirm(diff); writes only if true
 * - Existing + no confirm       → throws config_exists (legacy)
 * - --dry-run                   → logs what would be written, no disk write
 */
export async function writeConfig(
  cwd: string,
  config: MotionBlocksConfig,
  options: WriteConfigOptions = {}
): Promise<void> {
  const configPath = getConfigPath(cwd);
  const configJson = JSON.stringify(config, null, 2) + "\n";

  // Check if file already exists
  if (existsSync(configPath) && !options.overwrite) {
    if (options.confirm) {
      const diff = `motion-blocks.json already exists at ${configPath}.\n\nProposed new content:\n${configJson}`;
      const shouldWrite = await options.confirm(diff);
      if (!shouldWrite) {
        return;
      }
    } else {
      throw new MotionBlocksError(
        `motion-blocks.json already exists at ${configPath}.\n\nNext: Edit the existing file, or run \`motion-blocks init --overwrite\` to replace it.`,
        "config_exists",
      );
    }
  }

  if (options.dryRun) {
    console.log(`Would write to ${configPath}:`);
    console.log(configJson);
    return;
  }

  await writeFile(configPath, configJson, "utf-8");
}
