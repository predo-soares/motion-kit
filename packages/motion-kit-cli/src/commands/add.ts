import type { Command } from "commander";

import { createLogger } from "../utils/logger.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";

export function registerAddCommand(program: Command): void {
  withCommonOptions(
    program
      .command("add")
      .description("Install one or more Motion Kit registry items into the current project.")
      .argument("<components...>", "registry item names to install, e.g. magnetic"),
  )
    .option("--no-install", "skip installing npm dependencies")
    .action((components: string[], options: CommonOptions & { install: boolean }) => {
      const logger = createLogger({ verbose: options.verbose });

      logger.info(`add (stub) — cwd="${options.cwd}"`);
      logger.info(`would install: ${components.join(", ")}`);
      logger.info(
        options.install
          ? "would install npm dependencies for the requested items"
          : "would skip installing npm dependencies (--no-install)",
      );
      logger.verbose(`dry-run=${options.dryRun}`);
      logger.info("no files were written.");
    });
}
