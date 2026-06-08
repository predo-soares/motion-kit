import { getConfigPath, readConfig } from "../config/config-io.js";
import type { MotionKitConfig } from "../config/types.js";
import { detectFramework, getDefaultDirectories } from "../detection/detect-framework.js";
import { detectPackageManager } from "../detection/detect-pm.js";
import { MotionKitError } from "../utils/errors.js";

function missingConfigMessage(cwd: string): string {
  return `No motion-kit.json found at ${getConfigPath(cwd)}. Run \`motion-kit init\` to create one.`;
}

export async function requireConfig(cwd: string): Promise<MotionKitConfig> {
  const existing = await readConfig(cwd);
  if (!existing) {
    throw new MotionKitError(missingConfigMessage(cwd), "missing_config");
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

export async function resolveEffectiveConfig(cwd: string): Promise<MotionKitConfig> {
  return requireConfig(cwd);
}
