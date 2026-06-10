import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { requireConfig } from "./resolve-config.js";
import { MotionBlocksError } from "../utils/errors.js";

test("requireConfig throws missing_config when motion-blocks.json is absent", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-"));

  await assert.rejects(
    () => requireConfig(cwd),
    (error: unknown) => {
      assert.ok(error instanceof MotionBlocksError);
      assert.equal(error.code, "missing_config");
      assert.match(error.message, /motion-blocks init/);
      return true;
    },
  );
});

test("requireConfig returns committed config when motion-blocks.json exists", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-config-"));
  const config = {
    registry: "https://motionkit.org/r",
    componentsDir: "src/components/motion-blocks",
    helpersDir: "src/lib/motion-blocks",
  };

  await writeFile(join(cwd, "motion-blocks.json"), `${JSON.stringify(config, null, 2)}\n`);

  const resolved = await requireConfig(cwd);
  assert.deepEqual(resolved, config);
});
