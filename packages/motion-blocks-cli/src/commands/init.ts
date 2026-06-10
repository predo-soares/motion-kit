import { createInterface } from "node:readline";
import type { Command } from "commander";

import { createLogger } from "../utils/logger.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";
import { detectFramework, getDefaultDirectories } from "../detection/detect-framework.js";
import { detectPackageManager } from "../detection/detect-pm.js";
import { DEFAULT_CONFIG, type MotionBlocksConfig } from "../config/types.js";
import { writeConfig } from "../config/config-io.js";
import { ensureExperimentalDecorators } from "../install/patch-tsconfig.js";
import { ensureViteOptimizeDeps } from "../install/patch-vite-config.js";

async function confirmOverwrite(diff: string): Promise<boolean> {
  process.stdout.write(`\n${diff}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("Overwrite? [y/N] ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export function registerInitCommand(program: Command): void {
  withCommonOptions(
    program
      .command("init")
      .description("Detect the current project and write a motion-blocks config for it.")
      .option("--overwrite", "overwrite existing motion-blocks.json", false),
  ).action(async (options: CommonOptions & { overwrite?: boolean }) => {
    const logger = createLogger({ verbose: options.verbose });

    logger.verbose(`init — cwd="${options.cwd}"`);

    // Step 1: detect environment — fatal on failure
    let framework: Awaited<ReturnType<typeof detectFramework>>;
    let packageManager: Awaited<ReturnType<typeof detectPackageManager>>;

    try {
      logger.info("Detecting package manager...");
      packageManager = await detectPackageManager(options.cwd);
      logger.verbose(`Detected package manager: ${packageManager}`);

      logger.info("Detecting framework...");
      framework = await detectFramework(options.cwd);
      logger.verbose(`Detected framework: ${framework}`);
    } catch (error) {
      logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
      process.exit(1);
      return;
    }

    if (framework === "plain") {
      logger.warn(
        "Could not detect a supported framework. Set \"framework\" in motion-blocks.json manually after init.",
      );
    }

    const { componentsDir, helpersDir } = getDefaultDirectories(framework);

    const config: MotionBlocksConfig = {
      ...DEFAULT_CONFIG,
      registry: DEFAULT_CONFIG.registry ?? "https://motionkit.org/r",
      framework,
      packageManager,
      componentsDir,
      helpersDir,
    };

    logger.info("\nGenerated config:");
    console.log(JSON.stringify(config, null, 2));

    // Step 2: write config — declining is not fatal; patchers still run
    let configWritten = false;
    try {
      await writeConfig(options.cwd, config, {
        overwrite: options.overwrite,
        dryRun: options.dryRun,
        confirm: confirmOverwrite,
      });
      configWritten = true;
    } catch (error) {
      logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
    }

    // Step 3: apply patchers — don't depend on config being written
    try {
      await ensureExperimentalDecorators({
        cwd: options.cwd,
        framework,
        dryRun: options.dryRun,
        logger,
      });

      if (framework === "vue" || framework === "react") {
        await ensureViteOptimizeDeps({
          cwd: options.cwd,
          dryRun: options.dryRun,
          logger,
        });
      }
    } catch (error) {
      logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
      process.exit(1);
    }

    if (options.dryRun) {
      logger.info("\nDry run: no files were written.");
    } else if (configWritten) {
      logger.info("\n✓ Config written successfully");
      logger.info(`  → ${config.componentsDir}`);
      logger.info(`  → ${config.helpersDir}`);
    }
  });
}
