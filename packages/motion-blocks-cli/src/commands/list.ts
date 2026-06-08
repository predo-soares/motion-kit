import type { Command } from "commander";

import { filterCatalogItems, formatCatalogListItem } from "../catalog/filter-catalog.js";
import { loadRegistryCatalog } from "../catalog/load-catalog.js";
import { resolveEffectiveConfig } from "../install/resolve-config.js";
import type { RegistryItemType } from "../producer/types.js";
import { createLogger } from "../utils/logger.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";

const ITEM_TYPES: RegistryItemType[] = ["registry:component", "registry:lib", "registry:file"];

export function registerListCommand(program: Command): void {
  withCommonOptions(
    program
      .command("list")
      .description("List Motion Blocks registry items from the configured catalog.")
      .argument("[group]", "only list items in this group, e.g. interaction"),
  )
    .option("--all", "include hidden registry items such as internal helpers", false)
    .option("--type <type>", "filter by item type, e.g. registry:component or registry:lib")
    .action(async (
      group: string | undefined,
      options: CommonOptions & { all?: boolean; type?: string },
    ) => {
      const logger = createLogger({ verbose: options.verbose });

      logger.verbose(`list — cwd="${options.cwd}"`);

      if (options.type && !ITEM_TYPES.includes(options.type as RegistryItemType)) {
        logger.error(`Unknown item type "${options.type}". Expected one of: ${ITEM_TYPES.join(", ")}`);
        process.exit(1);
      }

      try {
        const config = await resolveEffectiveConfig(options.cwd);
        const { catalog, source } = await loadRegistryCatalog(config, options.cwd);
        const items = filterCatalogItems(catalog.items, {
          all: options.all,
          type: options.type as RegistryItemType | undefined,
          group,
        });

        logger.verbose(`catalog "${catalog.name}" loaded from ${source}`);

        if (items.length === 0) {
          logger.info("No registry items matched the current filters.");
          return;
        }

        const scope = [
          group ? `group "${group}"` : null,
          options.type ? `type ${options.type}` : null,
          options.all ? "including hidden" : "public only",
        ].filter(Boolean).join(", ");

        logger.info(`\n${items.length} item(s) (${scope}):`);
        for (const item of items) {
          console.log(`  ${formatCatalogListItem(item)}`);
        }
      } catch (error) {
        logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
        process.exit(1);
      }
    });
}
