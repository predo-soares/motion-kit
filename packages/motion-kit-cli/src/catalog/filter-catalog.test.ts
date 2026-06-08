import assert from "node:assert/strict";
import test from "node:test";

import type { RegistryItem } from "../producer/types.js";
import { filterCatalogItems, formatCatalogListItem } from "./filter-catalog.js";

const publicComponent: RegistryItem = {
  name: "magnetic",
  type: "registry:component",
  title: "Magnetic",
  description: "Public component",
  files: [
    {
      path: "src/registry/interaction/magnetic/magnetic-element.ts",
      type: "registry:component",
      target: "src/components/motion-kit/magnetic-element.ts",
    },
  ],
};

const hiddenLib: RegistryItem = {
  name: "gsap",
  type: "registry:lib",
  title: "GSAP helpers",
  description: "Hidden helper",
  meta: { hidden: true },
  files: [
    {
      path: "src/registry/lib/gsap/gsap.ts",
      type: "registry:lib",
      target: "src/lib/helpers/gsap.ts",
    },
  ],
};

test("filterCatalogItems excludes hidden items by default", () => {
  const items = filterCatalogItems([publicComponent, hiddenLib], {});
  assert.deepEqual(items.map((item) => item.name), ["magnetic"]);
});

test("filterCatalogItems includes hidden items with --all", () => {
  const items = filterCatalogItems([publicComponent, hiddenLib], { all: true });
  assert.deepEqual(items.map((item) => item.name), ["gsap", "magnetic"]);
});

test("filterCatalogItems filters by type and includes hidden libs", () => {
  const items = filterCatalogItems([publicComponent, hiddenLib], { type: "registry:lib" });
  assert.deepEqual(items.map((item) => item.name), ["gsap"]);
});

test("filterCatalogItems filters by group", () => {
  const items = filterCatalogItems([publicComponent, hiddenLib], { all: true, group: "lib" });
  assert.deepEqual(items.map((item) => item.name), ["gsap"]);
});

test("formatCatalogListItem marks hidden libs", () => {
  assert.match(formatCatalogListItem(hiddenLib), /gsap \(lib, hidden\)/);
  assert.match(formatCatalogListItem(publicComponent), /magnetic \(component\)/);
});
