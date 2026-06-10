import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveWriteDecision } from "./write-policy.js";

const noPrompt = async (_target: string): Promise<boolean> => {
  throw new Error("prompt should not be called");
};

async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "motion-blocks-write-policy-"));
}

// Branch 1: file does not exist → "write" (no prompt)
test("resolveWriteDecision: new file → write without calling prompt", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "new-file.ts");

  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "const x = 1;",
    flags: { dryRun: false, overwrite: false, interactive: false },
    prompt: noPrompt,
  });

  assert.equal(decision, "write");
});

// Branch 2: --overwrite flag → "write" (no prompt)
test("resolveWriteDecision: --overwrite on existing file → write without calling prompt", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "existing.ts");
  await writeFile(path, "old content", "utf-8");

  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "new content",
    flags: { dryRun: false, overwrite: true, interactive: false },
    prompt: noPrompt,
  });

  assert.equal(decision, "write");
});

// Branch 3: identical content → "identical-skip" (no prompt)
test("resolveWriteDecision: identical content → identical-skip without calling prompt", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "same.ts");
  const content = "const x = 1;\n";
  await writeFile(path, content, "utf-8");

  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: content,
    flags: { dryRun: false, overwrite: false, interactive: false },
    prompt: noPrompt,
  });

  assert.equal(decision, "identical-skip");
});

// Branch 4: --dry-run + conflict → "write" (no prompt)
test("resolveWriteDecision: --dry-run with conflicting file → write without calling prompt", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "conflict.ts");
  await writeFile(path, "old content", "utf-8");

  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "new content",
    flags: { dryRun: true, overwrite: false, interactive: false },
    prompt: noPrompt,
  });

  assert.equal(decision, "write");
});

// Branch 5: non-interactive + conflict → "skip" (no prompt)
test("resolveWriteDecision: non-interactive with conflict → skip without calling prompt", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "conflict.ts");
  await writeFile(path, "old content", "utf-8");

  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "new content",
    flags: { dryRun: false, overwrite: false, interactive: false },
    prompt: noPrompt,
  });

  assert.equal(decision, "skip");
});

// Branch 6a: interactive + conflict + prompt returns true → "write"
test("resolveWriteDecision: interactive conflict + prompt yes → write", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "conflict.ts");
  await writeFile(path, "old content", "utf-8");

  let promptCalled = false;
  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "new content",
    flags: { dryRun: false, overwrite: false, interactive: true },
    prompt: async (_target) => {
      promptCalled = true;
      return true;
    },
  });

  assert.equal(decision, "write");
  assert.equal(promptCalled, true);
});

// Branch 6b: interactive + conflict + prompt returns false → "skip"
test("resolveWriteDecision: interactive conflict + prompt no → skip", async () => {
  const dir = await makeTempDir();
  const path = join(dir, "conflict.ts");
  await writeFile(path, "old content", "utf-8");

  let promptCalled = false;
  const decision = await resolveWriteDecision({
    resolvedPath: path,
    incomingContent: "new content",
    flags: { dryRun: false, overwrite: false, interactive: true },
    prompt: async (_target) => {
      promptCalled = true;
      return false;
    },
  });

  assert.equal(decision, "skip");
  assert.equal(promptCalled, true);
});
