import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { installDependencies, planDependencyInstall } from "./install-deps.js";
import { createLogger } from "../utils/logger.js";

// Minimal logger that captures messages for assertions.
function makeCapturingLogger() {
  const messages: string[] = [];
  const logger = createLogger();
  return {
    messages,
    logger: {
      ...logger,
      info(message: string) {
        messages.push(message);
      },
    },
  };
}

// Make a real temp dir so any accidental spawn would have a valid cwd.
async function makeTempDir() {
  return mkdtemp(join(tmpdir(), "motion-blocks-install-deps-"));
}

// Build a minimal DependencyInstallPlan directly rather than going through
// planDependencyInstall to avoid needing a real package-manager environment.
function makePlan(command = "pnpm add gsap") {
  return {
    dependencies: ["gsap"],
    devDependencies: [],
    command,
  };
}

// ---------------------------------------------------------------------------
// confirm returning false → no spawn, manual step logged
// ---------------------------------------------------------------------------

test("installDependencies — confirm returning false prints command and skips spawn", async () => {
  const cwd = await makeTempDir();
  const { messages, logger } = makeCapturingLogger();

  let spawnAttempted = false;
  const plan = makePlan();

  await installDependencies(plan, {
    cwd,
    dryRun: false,
    noInstall: false,
    logger,
    confirm: async (_cmd) => {
      // Record that confirm was called, then decline.
      spawnAttempted = true;
      return false;
    },
  });

  assert.ok(spawnAttempted, "confirm callback should have been called");
  assert.ok(
    messages.some((m) => m.includes("run manually") && m.includes(plan.command)),
    `expected a "run manually: <command>" message, got: ${JSON.stringify(messages)}`,
  );
});

// ---------------------------------------------------------------------------
// --yes path: confirm auto-returns true → spawn proceeds
// (We can't actually spawn pnpm in tests, so we verify confirm is bypassed
// by injecting an always-true callback and checking no "run manually" message.)
// ---------------------------------------------------------------------------

test("installDependencies — confirm returning true does NOT print run manually", async () => {
  const cwd = await makeTempDir();
  const { messages, logger } = makeCapturingLogger();

  const plan = makePlan("echo noop");

  // Use "echo noop" as the command so spawn actually succeeds in the test env.
  await installDependencies(plan, {
    cwd,
    dryRun: false,
    noInstall: false,
    logger,
    confirm: async () => true,
  });

  assert.ok(
    !messages.some((m) => m.includes("run manually")),
    `unexpected "run manually" message when confirm returned true: ${JSON.stringify(messages)}`,
  );
});

// ---------------------------------------------------------------------------
// --no-install path: bypasses confirm entirely, prints manual command
// ---------------------------------------------------------------------------

test("installDependencies — noInstall bypasses confirm and prints run manually", async () => {
  const cwd = await makeTempDir();
  const { messages, logger } = makeCapturingLogger();

  let confirmCalled = false;
  const plan = makePlan();

  await installDependencies(plan, {
    cwd,
    dryRun: false,
    noInstall: true,
    logger,
    confirm: async () => {
      confirmCalled = true;
      return true;
    },
  });

  assert.ok(!confirmCalled, "confirm should NOT be called when noInstall is true");
  assert.ok(
    messages.some((m) => m.includes("run manually") && m.includes(plan.command)),
    `expected a "run manually: <command>" message, got: ${JSON.stringify(messages)}`,
  );
});

// ---------------------------------------------------------------------------
// Non-interactive path: no confirm callback → prints command, does not spawn
// ---------------------------------------------------------------------------

test("installDependencies — no confirm callback prints run manually (non-interactive)", async () => {
  const cwd = await makeTempDir();
  const { messages, logger } = makeCapturingLogger();

  const plan = makePlan();

  // Omit confirm to simulate non-interactive/no-TTY environment.
  await installDependencies(plan, {
    cwd,
    dryRun: false,
    noInstall: false,
    logger,
    // confirm intentionally omitted
  });

  assert.ok(
    messages.some((m) => m.includes("run manually") && m.includes(plan.command)),
    `expected a "run manually: <command>" message, got: ${JSON.stringify(messages)}`,
  );
});

// ---------------------------------------------------------------------------
// --yes does not affect overwrite (unrelated to installDependencies, but
// validate that planDependencyInstall still works correctly as a smoke test)
// ---------------------------------------------------------------------------

test("planDependencyInstall — returns null when no deps", () => {
  const result = planDependencyInstall([], "pnpm");
  assert.equal(result, null);
});

test("planDependencyInstall — builds correct command for deps and devDeps", () => {
  const result = planDependencyInstall(["gsap"], "pnpm", ["@types/gsap"]);
  assert.ok(result !== null);
  assert.ok(result.command.includes("gsap"));
  assert.ok(result.command.includes("@types/gsap"));
});
