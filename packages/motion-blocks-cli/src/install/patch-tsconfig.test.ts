import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureExperimentalDecorators } from "./patch-tsconfig.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger();

test("ensureExperimentalDecorators adds experimentalDecorators to tsconfig.app.json", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  await writeFile(
    join(cwd, "tsconfig.app.json"),
    `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`,
  );

  const result = await ensureExperimentalDecorators({
    cwd,
    framework: "vue",
    dryRun: false,
    logger,
  });

  assert.equal(result.patched, true);
  const content = await readFile(join(cwd, "tsconfig.app.json"), "utf-8");
  assert.match(content, /"experimentalDecorators": true/);
});

test("ensureExperimentalDecorators skips when already enabled", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  const original = `{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
`;
  await writeFile(join(cwd, "tsconfig.json"), original);

  const result = await ensureExperimentalDecorators({
    cwd,
    framework: "astro",
    dryRun: false,
    logger,
  });

  assert.equal(result.patched, false);
  assert.equal(result.skippedReason, "already enabled");
  const content = await readFile(join(cwd, "tsconfig.json"), "utf-8");
  assert.equal(content, original);
});

test("ensureExperimentalDecorators dry-run does not write", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  const original = `{
  "compilerOptions": {}
}
`;
  await writeFile(join(cwd, "tsconfig.json"), original);

  const result = await ensureExperimentalDecorators({
    cwd,
    dryRun: true,
    logger,
  });

  assert.equal(result.patched, true);
  const content = await readFile(join(cwd, "tsconfig.json"), "utf-8");
  assert.equal(content, original);
});

test("ensureExperimentalDecorators resolves tsconfig.app.json via references", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  await writeFile(
    join(cwd, "tsconfig.json"),
    `{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
`,
  );
  await writeFile(
    join(cwd, "tsconfig.app.json"),
    `{
  "compilerOptions": {
    "strict": true
  }
}
`,
  );

  await ensureExperimentalDecorators({
    cwd,
    framework: "vue",
    dryRun: false,
    logger,
  });

  const content = await readFile(join(cwd, "tsconfig.app.json"), "utf-8");
  assert.match(content, /"experimentalDecorators": true/);
});

test("ensureExperimentalDecorators parses tsconfig with trailing commas", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  await writeFile(
    join(cwd, "tsconfig.json"),
    `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
    },
  },
}
`,
  );

  await ensureExperimentalDecorators({
    cwd,
    framework: "astro",
    dryRun: false,
    logger,
  });

  const content = await readFile(join(cwd, "tsconfig.json"), "utf-8");
  assert.match(content, /"experimentalDecorators": true/);
});

test("ensureExperimentalDecorators patches nuxt.config.ts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  await writeFile(
    join(cwd, "nuxt.config.ts"),
    `export default defineNuxtConfig({
  devtools: { enabled: true },
})
`,
  );

  await ensureExperimentalDecorators({
    cwd,
    framework: "nuxt",
    dryRun: false,
    logger,
  });

  const content = await readFile(join(cwd, "nuxt.config.ts"), "utf-8");
  assert.match(content, /experimentalDecorators:\s*true/);
});

test("ensureExperimentalDecorators returns user skipped when confirm returns false", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-tsconfig-"));
  const original = `{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
`;
  await writeFile(join(cwd, "tsconfig.app.json"), original);

  const result = await ensureExperimentalDecorators({
    cwd,
    framework: "vue",
    dryRun: false,
    logger,
    confirm: async () => false,
  });

  assert.equal(result.patched, false);
  assert.equal(result.skippedReason, "user skipped");
  const content = await readFile(join(cwd, "tsconfig.app.json"), "utf-8");
  assert.equal(content, original);
});
