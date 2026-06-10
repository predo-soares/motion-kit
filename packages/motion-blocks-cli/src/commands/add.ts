import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { Command } from "commander";

import type { WriteDecisionOutcome } from "../install/add-item.js";
import { addItems } from "../install/add-item.js";
import { resolveEffectiveConfig } from "../install/resolve-config.js";
import { resolveRegistryInstallPlan } from "../install/resolve-registry-graph.js";
import { resolveWriteTarget } from "../install/resolve-target.js";
import { resolveWithinCwd } from "../utils/safe-path.js";
import { generateAssetPreview, generateUnifiedDiff } from "../utils/write-preview.js";
import { createLogger } from "../utils/logger.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";
import { createYesNoPrompt } from "../utils/prompts.js";

function buildPrompt(): (target: string) => Promise<boolean> {
  return (target: string): Promise<boolean> => createYesNoPrompt(`Overwrite ${target}? [y/N] `);
}

function buildDepConfirm(): (command: string) => Promise<boolean> {
  return (command: string): Promise<boolean> =>
    createYesNoPrompt(`\nAbout to run: ${command}\nProceed? [Y/n] `, false);
}

function formatWriteSummary(writes: { decision: WriteDecisionOutcome }[]): string {
  const counts: Partial<Record<WriteDecisionOutcome, number>> = {};
  for (const write of writes) {
    counts[write.decision] = (counts[write.decision] ?? 0) + 1;
  }
  const parts: string[] = [];
  for (const outcome of ["created", "updated", "skipped", "identical"] as WriteDecisionOutcome[]) {
    const count = counts[outcome];
    if (count && count > 0) parts.push(`${count} ${outcome}`);
  }
  return parts.join(", ");
}

async function runDiffPreview(
  components: string[],
  cwd: string,
  scopePath: string | undefined,
): Promise<void> {
  const config = await resolveEffectiveConfig(cwd);
  const plan = await resolveRegistryInstallPlan(components, config, cwd);
  let printed = 0;

  for (const resolved of plan.items) {
    for (const file of resolved.item.files) {
      const target = resolveWriteTarget(file, config);
      if (scopePath !== undefined && !target.endsWith(scopePath) && target !== scopePath) continue;

      if (file.asset === true) {
        const resolvedPath = resolveWithinCwd(cwd, target);
        const existingSize = existsSync(resolvedPath) ? (await readFile(resolvedPath)).byteLength : undefined;
        const preview = generateAssetPreview({
          sourceUrl: file.url ?? "(unknown)",
          incomingSize: 0,
          existingSize,
          changeKind: existingSize === undefined ? "new" : "replace",
        });
        console.log(`\n--- asset: ${target}`);
        console.log(JSON.stringify(preview, null, 2));
        printed += 1;
        continue;
      }

      const resolvedPath = resolveWithinCwd(cwd, target);
      const existingContent = existsSync(resolvedPath) ? await readFile(resolvedPath, "utf-8") : "";
      const diff = generateUnifiedDiff(existingContent, file.content ?? "");
      console.log(diff === null ? `\n(identical) ${target}` : `\n--- diff: ${target}\n${diff}`);
      printed += 1;
    }
  }

  if (printed === 0) {
    console.log(scopePath ? `No matching file found for path: ${scopePath}` : "No files in the resolved registry payload.");
  }
}

async function runViewPreview(
  components: string[],
  cwd: string,
  scopePath: string | undefined,
): Promise<void> {
  const config = await resolveEffectiveConfig(cwd);
  const plan = await resolveRegistryInstallPlan(components, config, cwd);
  let printed = 0;

  for (const resolved of plan.items) {
    for (const file of resolved.item.files) {
      const target = resolveWriteTarget(file, config);
      if (scopePath !== undefined && !target.endsWith(scopePath) && target !== scopePath) continue;

      if (file.asset === true) {
        const resolvedPath = resolveWithinCwd(cwd, target);
        const existingSize = existsSync(resolvedPath) ? (await readFile(resolvedPath)).byteLength : undefined;
        const preview = generateAssetPreview({
          sourceUrl: file.url ?? "(unknown)",
          incomingSize: 0,
          existingSize,
          changeKind: existingSize === undefined ? "new" : "replace",
        });
        console.log(`\n=== asset: ${target} ===`);
        console.log(JSON.stringify(preview, null, 2));
      } else {
        console.log(`\n=== ${target} ===`);
        console.log(file.content ?? "(no content)");
      }
      printed += 1;
    }
  }

  if (printed === 0) {
    console.log(scopePath ? `No matching file found for path: ${scopePath}` : "No files in the resolved registry payload.");
  }
}

export function registerAddCommand(program: Command): void {
  withCommonOptions(
    program
      .command("add")
      .description("Install one or more Motion Blocks registry items into the current project.")
      .argument("<components...>", "registry item names to install, e.g. magnetic"),
  )
    .option("--no-install", "skip installing npm dependencies")
    .option("--overwrite", "overwrite existing installed files", false)
    .option("--yes", "skip the dependency install confirmation prompt", false)
    .option("--diff [path]", "print unified diffs for files that would change, then exit without writing")
    .option("--view [path]", "print incoming file content (or asset metadata), then exit without writing")
    .action(async (
      components: string[],
      options: CommonOptions & {
        install: boolean;
        overwrite?: boolean;
        yes?: boolean;
        diff?: string | boolean;
        view?: string | boolean;
      },
    ) => {
      const logger = createLogger({ verbose: options.verbose });
      logger.verbose(`add — cwd="${options.cwd}"`);

      // --diff and --view are mutually exclusive
      if (options.diff !== undefined && options.diff !== false && options.view !== undefined && options.view !== false) {
        logger.error("Cannot use --diff and --view together. Choose one preview mode.");
        process.exit(1);
      }

      // --diff and --view are write-free preview paths
      if (options.diff !== undefined && options.diff !== false) {
        try {
          await runDiffPreview(components, options.cwd, typeof options.diff === "string" ? options.diff : undefined);
        } catch (error) {
          logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
          process.exit(1);
        }
        return;
      }

      if (options.view !== undefined && options.view !== false) {
        try {
          await runViewPreview(components, options.cwd, typeof options.view === "string" ? options.view : undefined);
        } catch (error) {
          logger.error(isMotionBlocksError(error) ? error.message : toErrorMessage(error));
          process.exit(1);
        }
        return;
      }

      const interactive = process.stdin.isTTY ?? false;

      // Dep install confirm: --yes = auto-approve, TTY = prompt, non-interactive = undefined (skip)
      const confirm = options.yes ? async () => true : interactive ? buildDepConfirm() : undefined;

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
          interactive,
          prompt: buildPrompt(),
          confirm,
          logger,
        });

        for (const result of results) {
          logger.verbose(`resolved "${result.itemName}" from ${result.source}`);
        }

        const allWrites = results.flatMap((r) => r.writes);
        if (allWrites.length > 0) {
          const summary = formatWriteSummary(allWrites);
          if (summary) logger.info(`\nFiles: ${summary}.`);
        }

        if (options.dryRun) {
          logger.info("\nDry run: no files were written.");
        } else {
          logger.info("\nDone.");
        }
      } catch (error) {
        if (isMotionBlocksError(error) && error.code === "missing_config") {
          logger.error(error.message);
        } else {
          logger.error(toErrorMessage(error));
        }
        process.exit(1);
      }
    });
}
