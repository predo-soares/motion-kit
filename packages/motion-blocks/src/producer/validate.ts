import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import type { DiscoveredItem, RegistryFile, RegistryItem } from "./types.js";

const ITEM_TYPES = ["registry:component", "registry:lib", "registry:file"];
const REQUIRED_TOP_LEVEL = ["name", "type", "title", "description", "files"] as const;
const REQUIRED_FILE_FIELDS = ["path", "type", "target"] as const;

export interface ValidationIssue {
  /** Repo-relative path to the manifest the issue was found in. */
  manifest: string;
  message: string;
}

export interface ItemValidationResult {
  item: DiscoveredItem;
  issues: ValidationIssue[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function validateShape(item: RegistryItem, report: (message: string) => void): void {
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in item)) report(`missing required field "${field}"`);
  }
  if ("type" in item && !ITEM_TYPES.includes(item.type)) {
    report(`unknown type "${item.type}" (expected one of ${ITEM_TYPES.join(", ")})`);
  }
  if (!Array.isArray(item.files) || item.files.length === 0) {
    report(`"files" must be a non-empty array`);
    return;
  }
  item.files.forEach((entry: RegistryFile, index: number) => {
    for (const field of REQUIRED_FILE_FIELDS) {
      if (!(field in entry)) report(`files[${index}] missing required field "${field}"`);
    }
    if ("asset" in entry) {
      if (!("url" in entry)) report(`files[${index}] has "asset" but no "url"`);
      if ("content" in entry) report(`files[${index}] has "asset" and inlined "content" (assets must use url, never content)`);
    }
  });
}

/**
 * Validates a single discovered item against the Milestone 01 source-manifest
 * rules: correct shape, no inlined content, and files living under the item's
 * own folder (or `src/registry/lib/<name>/` for shared `registry:lib` files).
 * Also confirms every referenced source file exists on disk so generation
 * cannot silently skip missing files.
 */
export async function validateSourceItem(discovered: DiscoveredItem, cwd: string): Promise<ValidationIssue[]> {
  const { item, group, manifestPath, hasOwnManifest } = discovered;
  const manifest = relative(cwd, manifestPath);
  const issues: ValidationIssue[] = [];
  const report = (message: string) => issues.push({ manifest, message });

  validateShape(item, report);

  if (item.type === "registry:component") {
    if (!Array.isArray(item.usage) || item.usage.length === 0) {
      report(`registry:component "${item.name}" must include a non-empty "usage" array`);
    }
  }

  if (item.meta?.hidden === true && item.type !== "registry:lib") {
    report(`"meta.hidden" is only supported on registry:lib items`);
  }

  if (!Array.isArray(item.files)) return issues;

  const ownFolder = `src/registry/${group}/${item.name}/`;
  const libFolder = "src/registry/lib/";

  for (const entry of item.files) {
    if (typeof entry.path !== "string") continue;

    if (hasOwnManifest && "content" in entry) {
      report(`files entry for "${entry.path}" inlines "content" — source manifests must not inline content`);
    }

    if (entry.type === "registry:lib") {
      if (!entry.path.startsWith(libFolder)) {
        report(`shared lib file "${entry.path}" is not under "${libFolder}" (registry:lib files belong in src/registry/lib/<name>/)`);
      }
    } else if (group !== "lib" && !entry.path.startsWith(ownFolder)) {
      report(`files entry "${entry.path}" is not under its own component folder (expected to start with "${ownFolder}")`);
      continue;
    }

    if (isAbsolute(entry.path) || relative(cwd, join(cwd, entry.path)).startsWith("..")) {
      report(`files entry "${entry.path}" resolves outside of the project root`);
      continue;
    }

    if (!(await pathExists(join(cwd, entry.path)))) {
      report(`source file "${entry.path}" does not exist on disk`);
    }
  }

  return issues;
}

export async function validateRegistryGraph(items: DiscoveredItem[], cwd: string): Promise<ItemValidationResult[]> {
  const results: ItemValidationResult[] = [];
  for (const discovered of items) {
    results.push({ item: discovered, issues: await validateSourceItem(discovered, cwd) });
  }
  return results;
}

export async function validatePublishedRegistryGraph(items: DiscoveredItem[], cwd: string): Promise<ItemValidationResult[]> {
  const results = await validateRegistryGraph(items, cwd);
  const visiblePublishedComponents = items.filter(({ item }) => isVisibleComponent(item));
  const includedVisibleNames = new Set(visiblePublishedComponents.map(({ item }) => item.name));
  const orderOwnersByGroup = new Map<string, Map<number, string>>();

  for (const result of results) {
    const { item, group, hasOwnManifest, manifestPath } = result.item;
    const manifest = relative(cwd, manifestPath);

    if (isVisibleComponent(item) && !hasOwnManifest) {
      result.issues.push({
        manifest,
        message: `published component "${item.name}" is included from a composed source registry but has no component.json at "src/registry/${group}/${item.name}/component.json"`,
      });
    }

    if (!isVisibleComponent(item)) continue;

    if (!(await pathExists(join(cwd, "src/components/demos", `${item.name}-demo.astro`)))) {
      result.issues.push({
        manifest,
        message: `visible published component "${item.name}" is missing demo partial "src/components/demos/${item.name}-demo.astro"`,
      });
    }

    validatePreviewRegistrationMetadata(item, result.issues, manifest);
    validateDocsOrder(item, group, result.issues, manifest, orderOwnersByGroup);
  }

  for (const manifest of await discoverComponentManifests(cwd)) {
    if (!isVisibleComponent(manifest.item)) continue;
    if (includedVisibleNames.has(manifest.item.name)) continue;

    results.push({
      item: {
        item: manifest.item,
        group: manifest.group,
        manifestPath: manifest.path,
        hasOwnManifest: true,
      },
      issues: [
        {
          manifest: relative(cwd, manifest.path),
          message: `visible component manifest "${manifest.item.name}" is not included in the composed source registries`,
        },
      ],
    });
  }

  return results;
}

function isVisibleComponent(item: RegistryItem) {
  return item.type === "registry:component" && item.meta?.hidden !== true;
}

function validatePreviewRegistrationMetadata(item: RegistryItem, issues: ValidationIssue[], manifest: string): void {
  const explicitRegistrations = getDocsMeta(item).previewRegistrations;
  const registrations = Array.isArray(explicitRegistrations)
    ? explicitRegistrations
    : item.files
        .filter((file) => file.type === "registry:component" && file.path.endsWith("-element.ts"))
        .map((file) => file.path);

  if (registrations.length === 0) {
    issues.push({
      manifest,
      message: `visible published component "${item.name}" has no preview registration metadata`,
    });
    return;
  }

  registrations.forEach((registration, index) => {
    if (typeof registration !== "string" || registration.length === 0) {
      issues.push({
        manifest,
        message: `visible published component "${item.name}" has invalid preview registration at meta.docs.previewRegistrations[${index}]`,
      });
    }
  });
}

function validateDocsOrder(
  item: RegistryItem,
  group: string,
  issues: ValidationIssue[],
  manifest: string,
  orderOwnersByGroup: Map<string, Map<number, string>>,
): void {
  const order = getDocsMeta(item).order;
  if (order === undefined) return;

  if (typeof order !== "number" || !Number.isInteger(order) || order < 0) {
    issues.push({
      manifest,
      message: `visible published component "${item.name}" has invalid meta.docs.order "${String(order)}" (expected a non-negative integer)`,
    });
    return;
  }

  let groupOrders = orderOwnersByGroup.get(group);
  if (!groupOrders) {
    groupOrders = new Map();
    orderOwnersByGroup.set(group, groupOrders);
  }

  const existing = groupOrders.get(order);
  if (existing) {
    issues.push({
      manifest,
      message: `visible published component "${item.name}" duplicates meta.docs.order ${order} already used by "${existing}" in group "${group}"`,
    });
    return;
  }

  groupOrders.set(order, item.name);
}

function getDocsMeta(item: RegistryItem): { order?: unknown; previewRegistrations?: unknown } {
  const docs = item.meta?.docs;
  return docs && typeof docs === "object" ? docs : {};
}

async function discoverComponentManifests(cwd: string): Promise<Array<{ item: RegistryItem; path: string; group: string }>> {
  const registryRoot = join(cwd, "src/registry");
  const manifests: Array<{ item: RegistryItem; path: string; group: string }> = [];
  await walkRegistryManifests(registryRoot, async (path) => {
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      return;
    }

    try {
      manifests.push({
        item: JSON.parse(raw) as RegistryItem,
        path,
        group: relative(registryRoot, path).replace(/\\/g, "/").split("/")[0] ?? "",
      });
    } catch {
      manifests.push({
        item: {
          name: relative(cwd, path),
          type: "registry:component",
          title: "",
          description: "",
          files: [],
        },
        path,
        group: relative(registryRoot, path).replace(/\\/g, "/").split("/")[0] ?? "",
      });
    }
  });
  return manifests;
}

async function walkRegistryManifests(dir: string, visit: (path: string) => Promise<void>): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkRegistryManifests(path, visit);
    } else if (entry.name === "component.json") {
      await visit(path);
    }
  }
}
