import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { DEFAULT_CONFIG, type MotionKitConfig } from "../config/types.js";
import type { RegistryItem } from "../producer/types.js";
import { MotionKitError } from "../utils/errors.js";

export interface RegistryCatalog {
  name: string;
  homepage?: string;
  items: RegistryItem[];
}

function isRemoteRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

function normalizeRegistryBase(registry: string): string {
  return registry.replace(/\/+$/, "");
}

export function resolveCatalogSource(config: MotionKitConfig, cwd: string): string {
  const registry = normalizeRegistryBase(config.registry);

  if (registry.endsWith(".json")) {
    return isAbsolute(registry) ? registry : resolve(cwd, registry);
  }

  if (isRemoteRef(registry)) {
    return `${registry}/registry.json`;
  }

  return resolve(cwd, registry, "registry.json");
}

function localMonorepoCatalogPath(cwd: string): string {
  return join(cwd, "public/r/registry.json");
}

export function resolveCatalogSourceWithLocalFallback(
  config: MotionKitConfig,
  cwd: string,
): string {
  const source = resolveCatalogSource(config, cwd);

  if (
    isRemoteRef(source) &&
    config.registry === DEFAULT_CONFIG.registry &&
    existsSync(localMonorepoCatalogPath(cwd))
  ) {
    return localMonorepoCatalogPath(cwd);
  }

  return source;
}

async function loadCatalogFromPath(path: string): Promise<RegistryCatalog> {
  if (!existsSync(path)) {
    throw new MotionKitError(`Registry catalog not found: ${path}`, "catalog_not_found");
  }

  const content = await readFile(path, "utf-8");
  const catalog = JSON.parse(content) as RegistryCatalog;

  if (!Array.isArray(catalog.items)) {
    throw new MotionKitError(`Invalid registry catalog at ${path}: missing "items" array`, "invalid_catalog");
  }

  return catalog;
}

async function loadCatalogFromUrl(url: string): Promise<RegistryCatalog> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MotionKitError(`Failed to fetch registry catalog from ${url}: ${message}`, "fetch_failed");
  }

  if (!response.ok) {
    throw new MotionKitError(
      `Failed to fetch registry catalog from ${url}: ${response.status} ${response.statusText}`,
      "fetch_failed",
    );
  }

  return (await response.json()) as RegistryCatalog;
}

export async function loadRegistryCatalog(
  config: MotionKitConfig,
  cwd: string,
): Promise<{ catalog: RegistryCatalog; source: string }> {
  const source = resolveCatalogSourceWithLocalFallback(config, cwd);
  const catalog = isRemoteRef(source)
    ? await loadCatalogFromUrl(source)
    : await loadCatalogFromPath(source);

  return { catalog, source };
}
