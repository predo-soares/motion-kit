import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ensureViteOptimizeDeps,
  patchViteOptimizeDeps,
  patchViteReactCompilerBabelInclude,
} from "./patch-vite-config.js";
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

test("patchViteReactCompilerBabelInclude scopes React Compiler to JSX files", () => {
  const input = `import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
})
`;

  const { content, changed } = patchViteReactCompilerBabelInclude(input);

  assert.equal(changed, true);
  assert.match(content, /babel\(\{\s*presets:\s*\[reactCompilerPreset\(\)\],\s*include:\s*\/\\\.\[jt\]sx\$\/\s*\}\)/);
});

test("patchViteReactCompilerBabelInclude skips Babel plugins without React Compiler", () => {
  const input = `export default defineConfig({
  plugins: [babel({ plugins: ['@babel/plugin-proposal-throw-expressions'] })],
})
`;

  const { content, changed } = patchViteReactCompilerBabelInclude(input);
  assert.equal(changed, false);
  assert.equal(content, input);
});

test("ensureViteOptimizeDeps dry-run does not write", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-vite-"));
  await writeFile(join(cwd, "vite.config.ts"), baseConfig);

  const result = await ensureViteOptimizeDeps({ cwd, dryRun: true, logger });

  assert.equal(result.patched, true);
  const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
  assert.equal(content, baseConfig);
});

test("ensureViteOptimizeDeps writes vite.config.ts", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-vite-"));
  await writeFile(join(cwd, "vite.config.ts"), baseConfig);

  await ensureViteOptimizeDeps({ cwd, dryRun: false, logger });

  const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
  assert.match(content, /optimizeDeps:/);
  assert.match(content, /'gsap'/);
});

test("ensureViteOptimizeDeps returns user skipped when confirm returns false", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "motion-blocks-vite-"));
  await writeFile(join(cwd, "vite.config.ts"), baseConfig);

  const result = await ensureViteOptimizeDeps({
    cwd,
    dryRun: false,
    logger,
    confirm: async () => false,
  });

  assert.equal(result.patched, false);
  assert.equal(result.skippedReason, "user skipped");
  const content = await readFile(join(cwd, "vite.config.ts"), "utf-8");
  assert.equal(content, baseConfig);
});
