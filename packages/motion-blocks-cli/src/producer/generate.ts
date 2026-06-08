import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DiscoveredItem, RegistryFile, RegistryItem } from "./types.js";

const SCHEMA_PATH = "/schema/registry-item.json";
const PUBLIC_PREFIX = "public/";

// Extensions that are always binary — never inlined as JSON string `content`,
// with or without an explicit `asset: true` flag on the source entry.
const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".mp4", ".webm", ".mov",
  ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".otf",
];

function isBinaryAssetPath(path: string): boolean {
  const lower = path.toLowerCase();
  return BINARY_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Derives the absolute URL an installed asset is served from, based on where it lands under `public/`. */
function assetUrl(homepage: string, target: string): string {
  const servedPath = target.startsWith(PUBLIC_PREFIX) ? target.slice(PUBLIC_PREFIX.length) : target;
  return new URL(servedPath, homepage).toString();
}

async function resolveFile(entry: RegistryFile, cwd: string, homepage: string): Promise<RegistryFile> {
  const isAsset = entry.asset === true || isBinaryAssetPath(entry.path);

  if (isAsset) {
    const { content: _content, ...rest } = entry;
    return { ...rest, asset: true, url: assetUrl(homepage, entry.target) };
  }

  const content = await readFile(join(cwd, entry.path), "utf8");
  const { asset: _asset, url: _url, ...rest } = entry;
  return { ...rest, content };
}

/** Generates the full consumer-facing payload for a single item, with inlined text content and asset URLs resolved. */
export async function generateItemPayload(discovered: DiscoveredItem, cwd: string, homepage: string): Promise<RegistryItem> {
  const { item } = discovered;
  const files = await Promise.all(item.files.map((entry) => resolveFile(entry, cwd, homepage)));

  return {
    ...item,
    $schema: new URL(SCHEMA_PATH, homepage).toString(),
    files,
  };
}

/** Strips per-payload-only fields (content, usage, props) to produce a lightweight catalog entry for the flattened registry.json. */
export function toCatalogEntry(payload: RegistryItem): RegistryItem {
  const { $schema: _schema, usage: _usage, props: _props, ...rest } = payload;
  return {
    ...rest,
    files: payload.files.map(({ content: _content, ...file }) => file),
  };
}
