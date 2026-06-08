/**
 * Motion Kit configuration types
 */

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export type Framework = "astro" | "next" | "react" | "vue" | "nuxt" | "svelte" | "sveltekit" | "plain";

export interface MotionKitConfig {
  $schema?: string;
  registry: string;
  framework?: Framework;
  packageManager?: PackageManager;
  componentsDir: string;
  helpersDir: string;
}

export const DEFAULT_CONFIG: Partial<MotionKitConfig> = {
  $schema: "https://motionkit.org/schemas/motion-kit.json",
  registry: "https://motionkit.org/r",
};
