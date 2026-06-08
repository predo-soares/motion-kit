import type { Command } from "commander";

import { addItems } from "../install/add-item.js";
import { createLogger } from "../utils/logger.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";

export function registerAddCommand(program: Command): void {
  withCommonOptions(
    program
      .command("add")
      .description("Install one or more Motion Blocks registry items into the current project.")
      .argument("<components...>", "registry item names to install, e.g. magnetic"),
  )
    .option("--no-install", "skip installing npm dependencies")
    .option("--overwrite", "overwrite existing installed files", false)
    .action(async (
      components: string[],
      options: CommonOptions & { install: boolean; overwrite?: boolean },
    ) => {
      const logger = createLogger({ verbose: options.verbose });

      logger.verbose(`add — cwd="${options.cwd}"`);

      try {
        logger.info(`\nInstalling ${components.join(", ")}...`);

        const results = await addItems({
          cwd: options.cwd,
          refs: components,
          ref: components[0]!,
          dryRun: options.dryRun,
          overwrite: options.overwrite ?? false,
          noInstall: !options.install,
          verbose: options.verbose,
          logger,
        });

        for (const result of results) {
          logger.verbose(`resolved "${result.itemName}" from ${result.source}`);
        }

        if (options.dryRun) {
          logger.info("\nDry run: no files were written.");
        } else {
          logger.info("\nDone.");
        }
      } catch (error) {
        if (isMotionBlocksError(error) && (error.code === "file_conflict" || error.code === "missing_config")) {
          logger.error(error.message);
        } else {
          logger.error(toErrorMessage(error));
        }
        process.exit(1);
      }
    });
}
