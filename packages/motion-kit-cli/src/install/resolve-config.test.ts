import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { requireConfig } from "./resolve-config.js";
import { MotionKitError } from "../utils/errors.js";

test("requireConfig throws missing_config when motion-kit.json is absent", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-kit-config-"));

  await assert.rejects(
    () => requireConfig(cwd),
    (error: unknown) => {
      assert.ok(error instanceof MotionKitError);
      assert.equal(error.code, "missing_config");
      assert.match(error.message, /motion-kit init/);
      return true;
    },
  );
});

test("requireConfig returns committed config when motion-kit.json exists", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-kit-config-"));
  const config = {
    registry: "https://motionkit.org/r",
    componentsDir: "src/components/motion-kit",
    helpersDir: "src/lib/motion-kit",
  };

  await writeFile(join(cwd, "motion-kit.json"), `${JSON.stringify(config, null, 2)}\n`);

  const resolved = await requireConfig(cwd);
  assert.deepEqual(resolved, config);
});
