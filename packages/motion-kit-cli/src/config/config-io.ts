import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MotionKitConfig } from "./types.js";
import { validateConfig } from "./validate-config.js";
import { MotionKitError } from "../utils/errors.js";

const CONFIG_FILENAME = "motion-kit.json";

/**
 * Get the path to the config file
 */
export function getConfigPath(cwd: string): string {
  return join(cwd, CONFIG_FILENAME);
}

/**
 * Read the motion-kit.json config file if it exists
 */
export async function readConfig(cwd: string): Promise<MotionKitConfig | null> {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    return validateConfig(JSON.parse(content), configPath);
  } catch (error) {
    if (error instanceof MotionKitError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new MotionKitError(
      `Failed to read or parse motion-kit.json at ${configPath}: ${message}\n\nNext: Fix the JSON syntax or run \`motion-kit init --overwrite\` to recreate the config.`,
      "invalid_config",
    );
  }
}

/**
 * Write the motion-kit.json config file with overwrite protection
 */
export async function writeConfig(
  cwd: string,
  config: MotionKitConfig,
  options: { overwrite?: boolean; dryRun?: boolean } = {}
): Promise<void> {
  const configPath = getConfigPath(cwd);

  // Check if file already exists
  if (existsSync(configPath) && !options.overwrite) {
    throw new MotionKitError(
      `motion-kit.json already exists at ${configPath}.\n\nNext: Edit the existing file, or run \`motion-kit init --overwrite\` to replace it.`,
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
