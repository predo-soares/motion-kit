import type { MotionKitConfig } from "../config/types.js";
import type { RegistryItem } from "../producer/types.js";
import { MotionKitError } from "../utils/errors.js";
import { resolveItem, resolveItemRef, type ResolvedItemSource } from "./resolve-item.js";

export interface RegistryInstallPlan {
  /** Topologically sorted items — registry dependencies before dependents. */
  items: ResolvedItemSource[];
  /** Item names in install order. */
  installOrder: string[];
  /** Item names the user explicitly requested (not pulled in as dependencies). */
  requestedNames: string[];
}

async function loadResolvedItem(
  ref: string,
  config: MotionKitConfig,
  cwd: string,
  registryBase?: string,
): Promise<ResolvedItemSource> {
  const source = resolveItemRef(ref, config, cwd, registryBase);
  return resolveItem(source, config, cwd);
}

export async function resolveRegistryInstallPlan(
  refs: string[],
  config: MotionKitConfig,
  cwd: string,
): Promise<RegistryInstallPlan> {
  const resolvedByName = new Map<string, ResolvedItemSource>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const installOrder: string[] = [];
  const requestedNames: string[] = [];
  const path: string[] = [];

  async function visit(ref: string, registryBase?: string, isRoot = false): Promise<void> {
    const resolved = await loadResolvedItem(ref, config, cwd, registryBase);
    const { name } = resolved.item;

    if (isRoot) {
      requestedNames.push(name);
    }

    if (visited.has(name)) {
      return;
    }

    if (visiting.has(name)) {
      const cycleStart = path.indexOf(name);
      const cyclePath = [...path.slice(cycleStart), name];
      throw new MotionKitError(
        `Registry dependency cycle detected: ${cyclePath.join(" → ")}`,
        "dependency_cycle",
      );
    }

    visiting.add(name);
    path.push(name);
    resolvedByName.set(name, resolved);

    for (const dependency of resolved.item.registryDependencies ?? []) {
      await visit(dependency, resolved.registryBase);
    }

    path.pop();
    visiting.delete(name);
    visited.add(name);
    installOrder.push(name);
  }

  for (const ref of refs) {
    await visit(ref, undefined, true);
  }

  return {
    items: installOrder.map((name) => resolvedByName.get(name)!),
    installOrder,
    requestedNames,
  };
}

export function mergeRegistryNpmDependencies(items: RegistryItem[]): {
  dependencies: string[];
  devDependencies: string[];
} {
  const dependencies = new Set<string>();
  const devDependencies = new Set<string>();

  for (const item of items) {
    for (const pkg of item.dependencies ?? []) {
      dependencies.add(pkg);
    }
    for (const pkg of item.devDependencies ?? []) {
      devDependencies.add(pkg);
    }
  }

  return {
    dependencies: [...dependencies],
    devDependencies: [...devDependencies],
  };
}
