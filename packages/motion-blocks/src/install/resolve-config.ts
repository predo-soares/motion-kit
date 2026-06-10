import { getConfigPath, readConfig } from "../config/config-io.js";
import type { MotionBlocksConfig } from "../config/types.js";
import { detectFramework, getDefaultDirectories } from "../detection/detect-framework.js";
import { detectPackageManager } from "../detection/detect-pm.js";
import { MotionBlocksError } from "../utils/errors.js";

function missingConfigMessage(cwd: string): string {
  return `No motion-blocks.json found at ${getConfigPath(cwd)}. Run \`motion-blocks init\` to create one.`;
}

export async function requireConfig(cwd: string): Promise<MotionBlocksConfig> {
  const existing = await readConfig(cwd);
  if (!existing) {
    throw new MotionBlocksError(missingConfigMessage(cwd), "missing_config");
  }

  if (existing.componentsDir && existing.helpersDir) {
    return existing;
  }

  const framework = existing.framework ?? (await detectFramework(cwd));
  const packageManager = existing.packageManager ?? (await detectPackageManager(cwd));
  const dirs = getDefaultDirectories(framework);

  return {
    ...existing,
    framework,
    packageManager,
    componentsDir: existing.componentsDir ?? dirs.componentsDir,
    helpersDir: existing.helpersDir ?? dirs.helpersDir,
  };
}

export async function resolveEffectiveConfig(cwd: string): Promise<MotionBlocksConfig> {
  return requireConfig(cwd);
}
