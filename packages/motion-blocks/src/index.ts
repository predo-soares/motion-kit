#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { registerAddCommand } from "./commands/add.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerInfoCommand } from "./commands/info.js";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";

const packageJson = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf-8"),
) as { version: string };

const program = new Command();

program
  .name("motion-blocks")
  .description("Motion Blocks registry CLI — install, build, and inspect animated Web Component items.")
  .version(packageJson.version);

registerBuildCommand(program);
registerInitCommand(program);
registerAddCommand(program);
registerListCommand(program);
registerInfoCommand(program);

await program.parseAsync(process.argv);
