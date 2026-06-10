import { readFile, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";

import { MotionBlocksError } from "../utils/errors.js";
import type { DiscoveredItem, RegistryItem } from "./types.js";

interface RootRegistry {
  name?: string;
  homepage?: string;
  include?: string[];
}

interface GroupRegistry {
  items?: RegistryItem[];
}

async function readJson<T>(path: string): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new MotionBlocksError(`Could not read "${path}"`, "manifest_not_found");
  }

  try {
    return JSON.parse(raw) as T;
  } catch (cause) {
    throw new MotionBlocksError(`"${path}" is not valid JSON: ${(cause as Error).message}`, "manifest_invalid_json");
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Derives the group name from an include path like "src/registry/interaction/registry.json". */
function groupNameFromIncludePath(includePath: string): string {
  return basename(dirname(includePath));
}

export interface RegistrySource {
  rootRegistryPath: string;
  name: string;
  homepage: string;
  items: DiscoveredItem[];
}

/**
 * Discovers published registry items by following the root `registry.json`
 * `include` chain into each grouped registry, then preferring the per-component
 * `component.json` (the opt-in source of truth) over the inline item data when
 * one exists alongside it.
 */
export async function discoverRegistryItems(cwd: string): Promise<RegistrySource> {
  const rootRegistryPath = join(cwd, "registry.json");
  const root = await readJson<RootRegistry>(rootRegistryPath);

  const items: DiscoveredItem[] = [];
  const seenNames = new Map<string, string>();

  for (const includePath of root.include ?? []) {
    const groupRegistryPath = join(cwd, includePath);
    const group = await readJson<GroupRegistry>(groupRegistryPath);
    const groupName = groupNameFromIncludePath(includePath);

    for (const groupItem of group.items ?? []) {
      const existingSource = seenNames.get(groupItem.name);
      if (existingSource) {
        throw new MotionBlocksError(
          `Duplicate registry item "${groupItem.name}" found in "${relative(cwd, groupRegistryPath)}" and "${existingSource}"`,
          "duplicate_item",
        );
      }
      seenNames.set(groupItem.name, relative(cwd, groupRegistryPath));

      const ownManifestPath = join(cwd, "src/registry", groupName, groupItem.name, "component.json");
      const hasOwnManifest = await pathExists(ownManifestPath);

      items.push({
        item: hasOwnManifest ? await readJson<RegistryItem>(ownManifestPath) : groupItem,
        group: groupName,
        manifestPath: hasOwnManifest ? ownManifestPath : groupRegistryPath,
        hasOwnManifest,
      });
    }
  }

  if (!root.name) throw new MotionBlocksError(`"${relative(cwd, rootRegistryPath)}" is missing required field "name"`, "registry_invalid");
  if (!root.homepage) throw new MotionBlocksError(`"${relative(cwd, rootRegistryPath)}" is missing required field "homepage"`, "registry_invalid");

  return { rootRegistryPath, name: root.name, homepage: root.homepage, items };
}
