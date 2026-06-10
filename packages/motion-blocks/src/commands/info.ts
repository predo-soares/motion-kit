import type { Command } from "commander";

import { createLogger } from "../utils/logger.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";
import { readConfig, getConfigPath } from "../config/config-io.js";
import { detectPackageManager } from "../detection/detect-pm.js";
import { detectFramework } from "../detection/detect-framework.js";

export function registerInfoCommand(program: Command): void {
  withCommonOptions(
    program
      .command("info")
      .description("Show detected project info and Motion Blocks configuration."),
  ).action(async (options: CommonOptions) => {
    const logger = createLogger({ verbose: options.verbose });

    logger.verbose(`info — cwd="${options.cwd}"`);

    try {
      // Read existing config or detect from project
      const config = await readConfig(options.cwd);

      // Detect current state
      const detectedPm = await detectPackageManager(options.cwd);
      const detectedFramework = await detectFramework(options.cwd);

      // Display detected info
      console.log("\nDetected project info:");
      console.log(`  Framework:    ${detectedFramework}`);
      console.log(`  Package mgr:  ${detectedPm}`);

      if (config) {
        console.log("\nMotion Blocks config:");
        console.log(`  Config file:   ${getConfigPath(options.cwd)}`);
        console.log(`  Registry:      ${config.registry}`);
        console.log(`  Framework:     ${config.framework || "(auto-detected)"}`);
        console.log(`  Package mgr:   ${config.packageManager || "(auto-detected)"}`);
        console.log(`  Components:    ${config.componentsDir}`);
        console.log(`  Helpers:       ${config.helpersDir}`);
      } else {
        console.log(`\nNo motion-blocks.json found at ${getConfigPath(options.cwd)}.`);
        console.log("Run `motion-blocks init` to create one.");
      }

      logger.verbose("");
    } catch (error) {
      logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
      process.exit(1);
    }
  });
}
