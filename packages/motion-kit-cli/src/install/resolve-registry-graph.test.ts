import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { DEFAULT_CONFIG } from "../config/types.js";
import { isMotionKitError } from "../utils/errors.js";
import { resolveRegistryInstallPlan } from "./resolve-registry-graph.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../../fixtures/registry");

const config = {
  ...DEFAULT_CONFIG,
  registry: fixturesDir,
  framework: "astro" as const,
  packageManager: "pnpm" as const,
  componentsDir: "src/components/motion-kit",
  helpersDir: "src/lib/helpers",
};

test("resolveRegistryInstallPlan topologically sorts registry dependencies", async () => {
  const plan = await resolveRegistryInstallPlan(
    [join(fixturesDir, "dup-a.json")],
    config,
    fixturesDir,
  );

  assert.deepEqual(plan.installOrder, ["shared-lib", "dup-a"]);
  assert.equal(plan.items.length, 2);
});

test("resolveRegistryInstallPlan installs shared dependencies once for multiple roots", async () => {
  const plan = await resolveRegistryInstallPlan(
    [join(fixturesDir, "dup-a.json"), join(fixturesDir, "dup-b.json")],
    config,
    fixturesDir,
  );

  assert.deepEqual(plan.installOrder, ["shared-lib", "dup-a", "dup-b"]);
  assert.equal(plan.items.length, 3);
});

test("resolveRegistryInstallPlan fails with a readable cycle path", async () => {
  await assert.rejects(
    () => resolveRegistryInstallPlan([join(fixturesDir, "cycle-a.json")], config, fixturesDir),
    (error: unknown) => {
      assert.ok(isMotionKitError(error));
      assert.equal(error.code, "dependency_cycle");
      assert.match(error.message, /cycle-a → cycle-b → cycle-a/);
      return true;
    },
  );
});
