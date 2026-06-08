import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureViteOptimizeDeps, patchViteOptimizeDeps } from "./patch-vite-config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger();

const baseConfig = `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': './src',
    },
  },
})
`;

test("patchViteOptimizeDeps adds optimizeDeps block", () => {
  const { content, changed } = patchViteOptimizeDeps(baseConfig);

  assert.equal(changed, true);
  assert.match(content, /optimizeDeps:\s*\{/);
  assert.match(content, /include:\s*\['lit',\s*'gsap'\]/);
});

test("patchViteOptimizeDeps merges missing deps into existing include", () => {
  const input = baseConfig.replace(
    "})",
    `  optimizeDeps: {
    include: ['lit']
  },
})`,
  );

  const { content, changed } = patchViteOptimizeDeps(input);

  assert.equal(changed, true);
  assert.match(content, /'lit'/);
  assert.match(content, /'gsap'/);
});

test("patchViteOptimizeDeps skips when already configured", () => {
  const input = baseConfig.replace(
    "})",
    `  optimizeDeps: {
    include: ['lit', 'gsap']
  },
})`,
  );

  const { changed } = patchViteOptimizeDeps(input);
  assert.equal(changed, false);
});

test("ensureViteOptimizeDeps dry-run does not write", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-kit-vite-"));
  await writeFile(join(cwd, "vite.config.ts"), baseConfig);

  const result = await ensureViteOptimizeDeps({ cwd, dryRun: true, logger });

  assert.equal(result.patched, true);
  const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
  assert.equal(content, baseConfig);
});

test("ensureViteOptimizeDeps writes vite.config.ts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-kit-vite-"));
  await writeFile(join(cwd, "vite.config.ts"), baseConfig);

  await ensureViteOptimizeDeps({ cwd, dryRun: false, logger });

  const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
  assert.match(content, /optimizeDeps:/);
  assert.match(content, /'gsap'/);
});
