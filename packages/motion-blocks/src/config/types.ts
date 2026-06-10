/**
 * Motion Blocks configuration types
 */

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type Framework = "astro" | "next" | "react" | "vue" | "nuxt" | "svelte" | "sveltekit" | "plain";

export interface MotionBlocksConfig {
  $schema?: string;
  registry: string;
  framework?: Framework;
  packageManager?: PackageManager;
  componentsDir: string;
  helpersDir: string;
}

export const DEFAULT_CONFIG: Partial<MotionBlocksConfig> = {
  $schema: "https://motionkit.org/schemas/motion-blocks.json",
  registry: "https://motionkit.org/r",
};
