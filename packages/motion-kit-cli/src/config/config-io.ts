import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MotionKitConfig } from "./types.js";

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
    return JSON.parse(content) as MotionKitConfig;
  } catch (error) {
    throw new Error(`Failed to read or parse ${CONFIG_FILENAME}: ${error}`);
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
    throw new Error(
      `${CONFIG_FILENAME} already exists. Use --overwrite to replace it, or edit it manually.`
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
