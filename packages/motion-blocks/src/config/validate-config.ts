import type { Framework, MotionBlocksConfig, PackageManager } from "./types.js";
import { MotionBlocksError } from "../utils/errors.js";

const FRAMEWORKS = new Set<Framework>([
  "astro",
  "next",
  "react",
  "vue",
  "nuxt",
  "svelte",
  "sveltekit",
  "plain",
]);

const PACKAGE_MANAGERS = new Set<PackageManager>(["pnpm", "npm", "yarn", "bun"]);

export function validateConfig(config: unknown, configPath: string): MotionBlocksConfig {
  const issues: string[] = [];
  const report = (message: string) => issues.push(message);

  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new MotionBlocksError(
      `Invalid motion-blocks.json at ${configPath}: expected a JSON object.\n\nNext: Run \`motion-blocks init\` to create a valid config.`,
      "invalid_config",
    );
  }

  const value = config as Record<string, unknown>;

  if (!("registry" in value) || typeof value.registry !== "string" || !value.registry.trim()) {
    report('"registry" must be a non-empty string');
  }

  if ("framework" in value && (typeof value.framework !== "string" || !FRAMEWORKS.has(value.framework as Framework))) {
    report(`"framework" must be one of: ${[...FRAMEWORKS].join(", ")}`);
  }

  if (
    "packageManager" in value
    && (typeof value.packageManager !== "string" || !PACKAGE_MANAGERS.has(value.packageManager as PackageManager))
  ) {
    report(`"packageManager" must be one of: ${[...PACKAGE_MANAGERS].join(", ")}`);
  }

  if ("componentsDir" in value && (typeof value.componentsDir !== "string" || !value.componentsDir.trim())) {
    report('"componentsDir" must be a non-empty string when provided');
  }

  if ("helpersDir" in value && (typeof value.helpersDir !== "string" || !value.helpersDir.trim())) {
    report('"helpersDir" must be a non-empty string when provided');
  }

  if (issues.length > 0) {
    throw new MotionBlocksError(
      `Invalid motion-blocks.json at ${configPath}:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\nNext: Run \`motion-blocks init --dry-run\` to see a valid config, or edit the file manually.`,
      "invalid_config",
    );
  }

  return value as unknown as MotionBlocksConfig;
}
