import { stat } from "node:fs/promises";
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
