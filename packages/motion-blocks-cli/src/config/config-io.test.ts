import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { writeConfig } from "./config-io.js";
import type { MotionBlocksConfig } from "./types.js";

const CONFIG_FILENAME = "motion-blocks.json";

const sampleConfig: MotionBlocksConfig = {
  registry: "https://motionkit.org/r",
  framework: "react",
  packageManager: "pnpm",
  componentsDir: "src/components/blocks",
  helpersDir: "src/lib",
};

// ---------------------------------------------------------------------------
// No existing config → written without prompt
// ---------------------------------------------------------------------------
test("writeConfig writes new file without prompting", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));

  let confirmCalled = false;
  await writeConfig(cwd, sampleConfig, {
    confirm: async () => {
      confirmCalled = true;
      return true;
    },
  });

  assert.equal(confirmCalled, false, "confirm should not be called when no file exists");
  const content = await readFile(join(cwd, CONFIG_FILENAME), "utf-8");
  const parsed = JSON.parse(content);
  assert.equal(parsed.framework, "react");
});

// ---------------------------------------------------------------------------
// Existing config + --overwrite → written without prompt
// ---------------------------------------------------------------------------
test("writeConfig overwrites existing file without prompting when overwrite=true", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));
  await writeFile(join(cwd, CONFIG_FILENAME), JSON.stringify({ framework: "vue" }), "utf-8");

  let confirmCalled = false;
  await writeConfig(cwd, sampleConfig, {
    overwrite: true,
    confirm: async () => {
      confirmCalled = true;
      return true;
    },
  });

  assert.equal(confirmCalled, false, "confirm should not be called when --overwrite is set");
  const content = await readFile(join(cwd, CONFIG_FILENAME), "utf-8");
  const parsed = JSON.parse(content);
  assert.equal(parsed.framework, "react");
});

// ---------------------------------------------------------------------------
// Existing config + confirm returning true → written
// ---------------------------------------------------------------------------
test("writeConfig writes when existing file and confirm returns true", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));
  await writeFile(join(cwd, CONFIG_FILENAME), JSON.stringify({ framework: "vue" }), "utf-8");

  let confirmCalled = false;
  let receivedDiff = "";
  await writeConfig(cwd, sampleConfig, {
    confirm: async (diff) => {
      confirmCalled = true;
      receivedDiff = diff;
      return true;
    },
  });

  assert.equal(confirmCalled, true, "confirm should be called when file exists");
  assert.match(receivedDiff, /motion-blocks\.json/);
  const content = await readFile(join(cwd, CONFIG_FILENAME), "utf-8");
  const parsed = JSON.parse(content);
  assert.equal(parsed.framework, "react");
});

// ---------------------------------------------------------------------------
// Existing config + confirm returning false → file unchanged, no error thrown
// ---------------------------------------------------------------------------
test("writeConfig leaves file unchanged when confirm returns false", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));
  const original = JSON.stringify({ framework: "vue" });
  await writeFile(join(cwd, CONFIG_FILENAME), original, "utf-8");

  // Should not throw
  await writeConfig(cwd, sampleConfig, {
    confirm: async () => false,
  });

  const content = await readFile(join(cwd, CONFIG_FILENAME), "utf-8");
  assert.equal(content, original, "file should be unchanged when confirm returns false");
});

// ---------------------------------------------------------------------------
// --dry-run → nothing written
// ---------------------------------------------------------------------------
test("writeConfig dry-run does not write any file", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));

  let confirmCalled = false;
  await writeConfig(cwd, sampleConfig, {
    dryRun: true,
    confirm: async () => {
      confirmCalled = true;
      return true;
    },
  });

  assert.equal(confirmCalled, false, "confirm should not be called during dry-run");
  // The file should not have been created
  await assert.rejects(
    () => readFile(join(cwd, CONFIG_FILENAME), "utf-8"),
    { code: "ENOENT" },
    "file should not exist after a dry-run",
  );
});

// ---------------------------------------------------------------------------
// Existing config + no confirm callback → legacy throw behaviour preserved
// ---------------------------------------------------------------------------
test("writeConfig throws config_exists when file exists and no confirm callback", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-io-"));
  await writeFile(join(cwd, CONFIG_FILENAME), JSON.stringify({ framework: "vue" }), "utf-8");

  await assert.rejects(
    () => writeConfig(cwd, sampleConfig),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /already exists/);
      return true;
    },
  );
});
