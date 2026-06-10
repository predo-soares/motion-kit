import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import type { DiscoveredItem, RegistryItem } from "./types.js";
import { validatePublishedRegistryGraph } from "./validate.js";

async function makeCwd(): Promise<string> {
  return mkdtemp(join(tmpdir(), "motion-blocks-validate-"));
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function componentItem(name: string, meta?: RegistryItem["meta"]): RegistryItem {
  return {
    name,
    type: "registry:component",
    title: name,
    description: `${name} description`,
    files: [
      {
        path: `src/registry/interaction/${name}/${name}-element.ts`,
        type: "registry:component",
        target: `src/components/motion-blocks/${name}-element.ts`,
      },
    ],
    usage: [{ label: "Astro", code: `<motion-${name}></motion-${name}>` }],
    meta,
  };
}

async function writeComponentFixture(cwd: string, item: RegistryItem, options: { demo?: boolean } = {}): Promise<DiscoveredItem> {
  await writeText(join(cwd, item.files[0]!.path), "export {};\n");
  const manifestPath = join(cwd, "src/registry/interaction", item.name, "component.json");
  await writeText(manifestPath, `${JSON.stringify(item, null, 2)}\n`);
  if (options.demo !== false) {
    await writeText(join(cwd, "src/components/demos", `${item.name}-demo.astro`), "<div />\n");
  }

  return {
    item,
    group: "interaction",
    manifestPath,
    hasOwnManifest: true,
  };
}

test("validatePublishedRegistryGraph reports included visible components without component manifests", async () => {
  const cwd = await makeCwd();
  const item = componentItem("missing-manifest");
  await writeText(join(cwd, item.files[0]!.path), "export {};\n");
  await writeText(join(cwd, "src/components/demos/missing-manifest-demo.astro"), "<div />\n");

  const results = await validatePublishedRegistryGraph(
    [
      {
        item,
        group: "interaction",
        manifestPath: join(cwd, "src/registry/interaction/registry.json"),
        hasOwnManifest: false,
      },
    ],
    cwd,
  );

  assert.match(
    results.flatMap((result) => result.issues).map((issue) => issue.message).join("\n"),
    /missing-manifest.*has no component\.json/,
  );
});

test("validatePublishedRegistryGraph reports visible manifests missing from composed source registries", async () => {
  const cwd = await makeCwd();
  await writeComponentFixture(cwd, componentItem("orphan"));

  const results = await validatePublishedRegistryGraph([], cwd);

  assert.match(
    results.flatMap((result) => result.issues).map((issue) => issue.message).join("\n"),
    /orphan.*not included in the composed source registries/,
  );
});

test("validatePublishedRegistryGraph reports missing demos and invalid preview registrations", async () => {
  const cwd = await makeCwd();
  const item = componentItem("broken-preview", {
    docs: { previewRegistrations: [] },
  });
  const discovered = await writeComponentFixture(cwd, item, { demo: false });

  const results = await validatePublishedRegistryGraph([discovered], cwd);
  const messages = results.flatMap((result) => result.issues).map((issue) => issue.message).join("\n");

  assert.match(messages, /broken-preview.*missing demo partial/);
  assert.match(messages, /broken-preview.*no preview registration metadata/);
});

test("validatePublishedRegistryGraph reports invalid and duplicate docs order metadata", async () => {
  const cwd = await makeCwd();
  const invalid = await writeComponentFixture(cwd, componentItem("invalid-order", { docs: { order: -1 } }));
  const first = await writeComponentFixture(cwd, componentItem("first-order", { docs: { order: 1 } }));
  const duplicate = await writeComponentFixture(cwd, componentItem("duplicate-order", { docs: { order: 1 } }));

  const results = await validatePublishedRegistryGraph([invalid, first, duplicate], cwd);
  const messages = results.flatMap((result) => result.issues).map((issue) => issue.message).join("\n");

  assert.match(messages, /invalid-order.*invalid meta\.docs\.order/);
  assert.match(messages, /duplicate-order.*duplicates meta\.docs\.order 1.*first-order/);
});
