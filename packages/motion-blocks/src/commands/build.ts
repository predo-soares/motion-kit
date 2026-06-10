import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

import type { Command } from "commander";

import { discoverRegistryItems } from "../producer/discover.js";
import { generateItemPayload, toCatalogEntry } from "../producer/generate.js";
import type { RegistryItem } from "../producer/types.js";
import { validatePublishedRegistryGraph } from "../producer/validate.js";
import { isMotionBlocksError, toErrorMessage } from "../utils/errors.js";
import { createLogger, type Logger } from "../utils/logger.js";
import { withCommonOptions, type CommonOptions } from "../utils/common-options.js";

const GENERATED_DIR = "public/r";

function writeJson(path: string, value: unknown): Promise<void> {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function registerBuildCommand(program: Command): void {
  withCommonOptions(
    program
      .command("build")
      .description(
        "Validate registry source manifests and regenerate the static payloads served from public/r.",
      ),
  )
    .option("--check", "validate manifests without writing generated payloads", false)
    .action(async (options: CommonOptions & { check: boolean }) => {
      const logger = createLogger({ verbose: options.verbose });
      try {
        await runBuild(options, logger);
      } catch (error) {
        if (isMotionBlocksError(error)) {
          logger.error(error.message);
        } else {
          logger.error(toErrorMessage(error));
        }
        process.exitCode = 1;
      }
    });
}

async function runBuild(options: CommonOptions & { check: boolean }, logger: Logger): Promise<void> {
  const { cwd } = options;

  logger.verbose(`discovering registry items from "${join(cwd, "registry.json")}"`);
  const source = await discoverRegistryItems(cwd);
  const { homepage } = source;
  logger.info(`discovered ${source.items.length} registry item(s) across ${countGroups(source.items.map((i) => i.group))} group(s)`);

  logger.verbose("validating source manifest graph");
  const results = await validatePublishedRegistryGraph(source.items, cwd);
  const invalid = results.filter((result) => result.issues.length > 0);
  const totalIssues = invalid.reduce((sum, result) => sum + result.issues.length, 0);

  if (invalid.length > 0) {
    logger.warn(`${totalIssues} validation issue(s) found across ${invalid.length} item(s):`);
    for (const result of invalid) {
      for (const issue of result.issues) logger.warn(`  ${issue.manifest}: ${issue.message}`);
    }
  }

  if (options.check) {
    if (invalid.length > 0) {
      logger.error("--check failed — fix the issues above before regenerating public/r.");
      process.exitCode = 1;
    } else {
      logger.info(`✓ ${source.items.length} source manifest(s) valid — no files were written.`);
    }
    return;
  }

  logger.verbose(`generating payloads for ${source.items.length} item(s)`);
  const payloads: RegistryItem[] = [];
  for (const discovered of source.items) {
    payloads.push(await generateItemPayload(discovered, cwd, homepage));
  }

  const registryCatalog = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: source.name,
    homepage,
    items: payloads.map(toCatalogEntry),
  };

  const generatedDir = join(cwd, GENERATED_DIR);

  if (options.dryRun) {
    logger.info(`would write ${payloads.length} item payload(s) and a flattened registry.json to "${relative(cwd, generatedDir)}"`);
    return;
  }

  await mkdir(generatedDir, { recursive: true });
  await pruneStalePayloads(generatedDir, payloads, logger);

  for (const payload of payloads) {
    await writeJson(join(generatedDir, `${payload.name}.json`), payload);
  }
  await writeJson(join(generatedDir, "registry.json"), registryCatalog);

  logger.info(`✓ wrote ${payloads.length} item payload(s) and registry.json to "${relative(cwd, generatedDir)}"`);
}

/** Removes generated payloads whose source item is no longer published, so public/r never serves orphans. */
async function pruneStalePayloads(generatedDir: string, payloads: RegistryItem[], logger: Logger): Promise<void> {
  const expected = new Set(payloads.map((payload) => `${payload.name}.json`));
  expected.add("registry.json");

  for (const entry of await readdir(generatedDir)) {
    if (entry.endsWith(".json") && !expected.has(entry)) {
      await unlink(join(generatedDir, entry));
      logger.warn(`removed stale payload "${join(GENERATED_DIR, entry)}" (no published source item)`);
    }
  }
}

function countGroups(groups: string[]): number {
  return new Set(groups).size;
}
