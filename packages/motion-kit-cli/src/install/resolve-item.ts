import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import type { RegistryItem } from "../producer/types.js";
import type { MotionKitConfig } from "../config/types.js";
import { MotionKitError } from "../utils/errors.js";
import { validateConsumerPayload } from "./validate-payload.js";

export interface ResolvedItemSource {
  item: RegistryItem;
  /** Absolute URL or filesystem path the item was loaded from. */
  source: string;
  /** Base URL for resolving relative asset URLs. */
  origin: string;
  /** Base used to resolve bare registry dependency names for this item. */
  registryBase: string;
}

function isRemoteRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

function isLocalJsonRef(ref: string): boolean {
  return ref.endsWith(".json");
}

function normalizeRegistryBase(registry: string): string {
  return registry.replace(/\/+$/, "");
}

export function registryBaseFromSource(source: string): string {
  if (isRemoteRef(source)) {
    const url = new URL(source);
    const pathname = url.pathname.replace(/\/[^/]+\.json$/i, "");
    url.pathname = pathname || "/";
    return normalizeRegistryBase(url.toString().replace(/\/$/, ""));
  }

  return normalizeRegistryBase(dirname(isAbsolute(source) ? source : resolve(source)));
}

export function resolveItemRef(
  ref: string,
  config: MotionKitConfig,
  cwd: string,
  registryBase?: string,
): string {
  if (isRemoteRef(ref)) {
    return ref;
  }

  if (isLocalJsonRef(ref)) {
    return isAbsolute(ref) ? ref : resolve(cwd, ref);
  }

  const base = normalizeRegistryBase(registryBase ?? config.registry);
  return `${base}/${ref}.json`;
}

async function loadFromPath(path: string): Promise<RegistryItem> {
  if (!existsSync(path)) {
    throw new MotionKitError(
      `Registry item not found: ${path}\n\nNext: Run \`motion-kit list\` to see available items, or check the name and your \`registry\` setting in motion-kit.json.`,
      "item_not_found",
    );
  }

  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as RegistryItem;
}

async function loadFromUrl(url: string): Promise<RegistryItem> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new MotionKitError(
      `Failed to fetch registry item from ${url}: ${message}\n\nNext: Check your network connection and the \`registry\` URL in motion-kit.json.`,
      "fetch_failed",
    );
  }

  if (!response.ok) {
    throw new MotionKitError(
      `Failed to fetch registry item from ${url}: ${response.status} ${response.statusText}\n\nNext: Confirm the item exists with \`motion-kit list\` and that your \`registry\` URL is correct.`,
      "fetch_failed",
    );
  }

  return (await response.json()) as RegistryItem;
}

function itemOrigin(source: string): string {
  if (isRemoteRef(source)) {
    return new URL(".", source).toString();
  }

  return new URL(`file://${source.endsWith("/") ? source : `${source}/`}`).toString();
}

export async function resolveItem(
  ref: string,
  config: MotionKitConfig,
  cwd: string,
): Promise<ResolvedItemSource> {
  const source = resolveItemRef(ref, config, cwd);

  const item = isRemoteRef(source)
    ? await loadFromUrl(source)
    : await loadFromPath(source);

  validateConsumerPayload(item, source);

  return {
    item,
    source,
    origin: itemOrigin(source),
    registryBase: registryBaseFromSource(source),
  };
}

export function resolveAssetUrl(assetUrl: string, origin: string): string {
  return new URL(assetUrl, origin).toString();
}
