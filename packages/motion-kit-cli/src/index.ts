#!/usr/bin/env node
import { Command } from "commander";

import { registerAddCommand } from "./commands/add.js";
import { registerBuildCommand } from "./commands/build.js";
import { registerInfoCommand } from "./commands/info.js";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";

const program = new Command();

program
  .name("motion-kit")
  .description("Motion Kit registry CLI — install, build, and inspect animated Web Component items.")
  .version("0.0.1");

registerBuildCommand(program);
registerInitCommand(program);
registerAddCommand(program);
registerListCommand(program);
registerInfoCommand(program);

await program.parseAsync(process.argv);
