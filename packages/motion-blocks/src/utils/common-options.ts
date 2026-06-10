import type { Command } from "commander";

export interface CommonOptions {
  cwd: string;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Adds the options every motion-blocks command supports: --cwd, --dry-run, and
 * --verbose. Defined per-command (rather than on the root program) so they
 * show up in each command's own --help output.
 */
export function withCommonOptions(command: Command): Command {
  return command
    .option("--cwd <path>", "directory to run the command in", process.cwd())
    .option("--dry-run", "report what would happen without writing anything", false)
    .option("--verbose", "print verbose diagnostic output", false);
}
