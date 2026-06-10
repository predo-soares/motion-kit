import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import type { DiscoveredItem, RegistryItem } from "./types.js";
import { generateItemPayload, toCatalogEntry } from "./generate.js";

async function makeCwd(): Promise<string> {
  return mkdtemp(join(tmpdir(), "motion-blocks-generate-"));
}

async function writeText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
}

function discovered(item: RegistryItem): DiscoveredItem {
  return {
    item,
    group: "interaction",
    manifestPath: "/fixture/component.json",
    hasOwnManifest: true,
  };
}

test("generateItemPayload inlines text files while preserving targets", async () => {
  const cwd = await makeCwd();
  await writeText(join(cwd, "src/registry/interaction/simple/simple-element.ts"), "export class SimpleElement {}\n");

  const payload = await generateItemPayload(
    discovered({
      name: "simple",
      type: "registry:component",
      title: "Simple",
      description: "Simple component",
      files: [
        {
          path: "src/registry/interaction/simple/simple-element.ts",
          type: "registry:component",
          target: "src/components/motion-blocks/simple-element.ts",
        },
      ],
    }),
    cwd,
    "https://motion.example/",
  );

  assert.equal(payload.files[0]!.target, "src/components/motion-blocks/simple-element.ts");
  assert.match(payload.files[0]!.content ?? "", /SimpleElement/);
  assert.equal(payload.files[0]!.asset, undefined);
});

test("generateItemPayload emits binary and explicit assets as URLs without content", async () => {
  const cwd = await makeCwd();

  const payload = await generateItemPayload(
    discovered({
      name: "assetful",
      type: "registry:component",
      title: "Assetful",
      description: "Asset component",
      files: [
        {
          path: "src/registry/canvas/globe/land-texture.png",
          type: "registry:component",
          target: "public/motion-blocks/land-texture.png",
        },
        {
          path: "src/registry/showcase/video/clip.txt",
          type: "registry:file",
          target: "public/motion-blocks/clip.txt",
          asset: true,
        },
      ],
    }),
    cwd,
    "https://motion.example/docs/",
  );

  assert.deepEqual(payload.files.map((file) => file.asset), [true, true]);
  assert.equal(payload.files[0]!.content, undefined);
  assert.equal(payload.files[1]!.content, undefined);
  assert.equal(payload.files[0]!.url, "https://motion.example/docs/motion-blocks/land-texture.png");
  assert.equal(payload.files[1]!.url, "https://motion.example/docs/motion-blocks/clip.txt");
});

test("toCatalogEntry strips payload-only fields while preserving install metadata", () => {
  const catalogEntry = toCatalogEntry({
    $schema: "https://motion.example/schema/registry-item.json",
    name: "card-stack",
    type: "registry:component",
    title: "Card Stack",
    description: "Stacked cards",
    dependencies: ["lit"],
    registryDependencies: ["gsap"],
    meta: { hidden: false },
    files: [
      {
        path: "src/registry/interaction/card-stack/card-stack-element.ts",
        type: "registry:component",
        target: "src/components/motion-blocks/card-stack-element.ts",
        content: "export {};\n",
      },
      {
        path: "src/registry/canvas/globe/land-texture.png",
        type: "registry:component",
        target: "public/motion-blocks/land-texture.png",
        asset: true,
        url: "https://motion.example/motion-blocks/land-texture.png",
      },
    ],
    usage: [{ label: "Astro", code: "<motion-card-stack />" }],
    props: [
      {
        name: "gap",
        type: "number",
        default: "0",
        description: "Gap between cards.",
      },
    ],
  });

  assert.equal(catalogEntry.$schema, undefined);
  assert.equal(catalogEntry.usage, undefined);
  assert.equal(catalogEntry.props, undefined);
  assert.deepEqual(catalogEntry.dependencies, ["lit"]);
  assert.deepEqual(catalogEntry.registryDependencies, ["gsap"]);
  assert.deepEqual(catalogEntry.meta, { hidden: false });
  assert.equal(catalogEntry.files[0]!.content, undefined);
  assert.equal(catalogEntry.files[0]!.target, "src/components/motion-blocks/card-stack-element.ts");
  assert.equal(catalogEntry.files[1]!.asset, true);
  assert.equal(catalogEntry.files[1]!.url, "https://motion.example/motion-blocks/land-texture.png");
});
