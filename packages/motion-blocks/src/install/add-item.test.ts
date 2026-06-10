import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { addItems } from "./add-item.js";
import { createLogger } from "../utils/logger.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/registry");

const logger = createLogger();

const noPrompt = async (_target: string): Promise<boolean> => {
  throw new Error("prompt should not be called in this test");
};

const yesPrompt = async (_target: string): Promise<boolean> => true;
const noAnswerPrompt = async (_target: string): Promise<boolean> => false;

async function makeCwd(): Promise<string> {
  return mkdtemp(join(tmpdir(), "motion-blocks-add-item-"));
}

async function writeConfig(cwd: string): Promise<void> {
  const config = {
    registry: fixturesDir,
    framework: "astro",
    packageManager: "pnpm",
    componentsDir: "src/components/motion-blocks",
    helpersDir: "src/lib/helpers",
  };
  await writeFile(join(cwd, "motion-blocks.json"), JSON.stringify(config, null, 2));
}

function itemPath(cwd: string): string {
  return join(cwd, "src/components/motion-blocks/simple-item.ts");
}

// Integration test 1: new file → created
test("add-item: new file is written with decision=created", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: false,
    prompt: noPrompt,
    logger,
  });

  assert.ok(result);
  const write = result.writes[0]!;
  assert.equal(write.decision, "created");

  const content = await readFile(itemPath(cwd), "utf-8");
  assert.match(content, /SimpleItem/);
});

// Integration test 2: existing identical content → identical (silently skipped, no prompt)
test("add-item: existing identical file → decision=identical, file unchanged, no prompt", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  // First install creates the file
  await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: false,
    prompt: noPrompt,
    logger,
  });

  // Second install on identical content → identical
  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: false,
    prompt: noPrompt,
    logger,
  });

  assert.ok(result);
  assert.equal(result.writes[0]!.decision, "identical");
});

// Integration test 3: existing changed file + prompt returns true → updated
test("add-item: changed file + prompt yes → decision=updated, file overwritten", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  const path = itemPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "// old content\n", "utf-8");

  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: true,
    prompt: yesPrompt,
    logger,
  });

  assert.ok(result);
  assert.equal(result.writes[0]!.decision, "updated");
  const content = await readFile(path, "utf-8");
  assert.match(content, /SimpleItem/);
});

// Integration test 4: existing changed file + prompt returns false → skipped
test("add-item: changed file + prompt no → decision=skipped, file unchanged", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  const path = itemPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  const original = "// old content\n";
  await writeFile(path, original, "utf-8");

  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: true,
    prompt: noAnswerPrompt,
    logger,
  });

  assert.ok(result);
  assert.equal(result.writes[0]!.decision, "skipped");
  const content = await readFile(path, "utf-8");
  assert.equal(content, original);
});

// Integration test 5: --overwrite → updated without prompt
test("add-item: --overwrite with existing changed file → decision=updated, no prompt", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  const path = itemPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "// old content\n", "utf-8");

  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: false,
    overwrite: true,
    noInstall: true,
    verbose: false,
    interactive: false,
    prompt: noPrompt,
    logger,
  });

  assert.ok(result);
  assert.equal(result.writes[0]!.decision, "updated");
  const content = await readFile(path, "utf-8");
  assert.match(content, /SimpleItem/);
});

// Integration test 6: --dry-run → nothing written to disk
test("add-item: --dry-run → file not written, decision=created", async () => {
  const cwd = await makeCwd();
  await writeConfig(cwd);

  const [result] = await addItems({
    cwd,
    refs: ["simple-item"],
    ref: "simple-item",
    dryRun: true,
    overwrite: false,
    noInstall: true,
    verbose: false,
    interactive: false,
    prompt: noPrompt,
    logger,
  });

  assert.ok(result);
  assert.equal(result.writes[0]!.decision, "created");

  // File must NOT exist on disk — dry-run only logs, never writes
  assert.equal(existsSync(itemPath(cwd)), false);
});
