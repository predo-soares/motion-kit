import type { Command } from "commander";

import { createLogger } from "../utils/logger.js";
import { isMotionKitError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";
import { detectFramework, getDefaultDirectories } from "../detection/detect-framework.js";
import { detectPackageManager } from "../detection/detect-pm.js";
import { DEFAULT_CONFIG, type MotionKitConfig } from "../config/types.js";
import { writeConfig } from "../config/config-io.js";
import { ensureExperimentalDecorators } from "../install/patch-tsconfig.js";
import { ensureViteOptimizeDeps } from "../install/patch-vite-config.js";

export function registerInitCommand(program: Command): void {
  withCommonOptions(
    program
      .command("init")
      .description("Detect the current project and write a motion-kit config for it.")
      .option("--overwrite", "overwrite existing motion-kit.json", false),
  ).action(async (options: CommonOptions & { overwrite?: boolean }) => {
    const logger = createLogger({ verbose: options.verbose });

    logger.verbose(`init — cwd="${options.cwd}"`);

    try {
      // Detect package manager
      logger.info("Detecting package manager...");
      const packageManager = await detectPackageManager(options.cwd);
      logger.verbose(`Detected package manager: ${packageManager}`);

      // Detect framework
      logger.info("Detecting framework...");
      const framework = await detectFramework(options.cwd);
      logger.verbose(`Detected framework: ${framework}`);

      if (framework === "plain") {
        logger.warn(
          "Could not detect a supported framework. Set \"framework\" in motion-kit.json manually after init.",
        );
      }

      // Get default directories for the framework
      const { componentsDir, helpersDir } = getDefaultDirectories(framework);

      // Build the config object
      const config: MotionKitConfig = {
        ...DEFAULT_CONFIG,
        registry: DEFAULT_CONFIG.registry ?? "https://motionkit.org/r",
        framework,
        packageManager,
        componentsDir,
        helpersDir,
      };

      // Log what we're going to write
      logger.info("\nGenerated config:");
      console.log(JSON.stringify(config, null, 2));

      // Write the config
      await writeConfig(options.cwd, config, {
        overwrite: options.overwrite,
        dryRun: options.dryRun,
      });

      await ensureExperimentalDecorators({
        cwd: options.cwd,
        framework,
        dryRun: options.dryRun,
        logger,
      });

      if (framework === "vue") {
        await ensureViteOptimizeDeps({
          cwd: options.cwd,
          dryRun: options.dryRun,
          logger,
        });
      }

      if (options.dryRun) {
        logger.info("\nDry run: no files were written.");
      } else {
        logger.info("\n✓ Config written successfully");
        logger.info(`  → ${config.componentsDir}`);
        logger.info(`  → ${config.helpersDir}`);
      }
    } catch (error) {
      logger.error(isMotionKitError(error) ? error.message : toErrorMessage(error));
      process.exit(1);
    }
  });
}
