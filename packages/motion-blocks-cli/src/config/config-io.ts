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

/**
 * Write the motion-blocks.json config file with overwrite protection
 */
export async function writeConfig(
  cwd: string,
  config: MotionBlocksConfig,
  options: { overwrite?: boolean; dryRun?: boolean } = {}
): Promise<void> {
  const configPath = getConfigPath(cwd);

  // Check if file already exists
  if (existsSync(configPath) && !options.overwrite) {
    throw new MotionBlocksError(
      `motion-blocks.json already exists at ${configPath}.\n\nNext: Edit the existing file, or run \`motion-blocks init --overwrite\` to replace it.`,
      "config_exists",
    );
  }

  const configJson = JSON.stringify(config, null, 2) + "\n";

  if (options.dryRun) {
    console.log(`Would write to ${configPath}:`);
    console.log(configJson);
    return;
  }

  await writeFile(configPath, configJson, "utf-8");
}
