import type { Command } from "commander";

import { createLogger } from "../utils/logger.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";

export function registerListCommand(program: Command): void {
  withCommonOptions(
    program
      .command("list")
      .description("List Motion Kit registry items, optionally filtered by group.")
      .argument("[group]", "only list items in this group, e.g. interaction"),
  ).action((group: string | undefined, options: CommonOptions) => {
    const logger = createLogger({ verbose: options.verbose });

    logger.info(`list (stub) — cwd="${options.cwd}"`);
    logger.info(group ? `would list registry items in group "${group}"` : "would list all registry items");
    logger.verbose(`dry-run=${options.dryRun}`);
  });
}
