#!/usr/bin/env node
// Validates Motion Kit registry manifests against the v0 item contract
// (public/schema/registry-item.json) plus the source-vs-generated rules that
// a single JSON schema cannot express on its own:
//   - source component.json must not inline files[].content
//   - source component code must live under its own component folder
//     (registry:lib items live under src/registry/lib/<name>/)
//   - generated public/r/<name>.json must inline content for text/code files
//     and must never inline content for asset files
//
// Run without changing public/r: `node scripts/validate-registry.mjs`

import { readFile, readdir } from "node:fs/promises";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ITEM_TYPES = ["registry:component", "registry:lib", "registry:file"];
const REQUIRED_TOP_LEVEL = ["name", "type", "title", "description", "files"];
const REQUIRED_FILE_FIELDS = ["path", "type", "target"];

// Extensions that are always binary — these must never be inlined as JSON
// string `content`, with or without an explicit `asset: true` flag.
const BINARY_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico",
  ".mp4", ".webm", ".mov",
  ".mp3", ".wav", ".ogg",
  ".woff", ".woff2", ".ttf", ".otf",
];

function isBinaryAssetPath(path) {
  const lower = path.toLowerCase();
  return BINARY_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** @type {string[]} */
const errors = [];

function fail(file, message) {
  errors.push(`${relative(root, file)}: ${message}`);
}

function validateShape(file, manifest) {
  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in manifest)) fail(file, `missing required field "${field}"`);
  }
  if ("type" in manifest && !ITEM_TYPES.includes(manifest.type)) {
    fail(file, `unknown type "${manifest.type}" (expected one of ${ITEM_TYPES.join(", ")})`);
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    fail(file, `"files" must be a non-empty array`);
    return;
  }
  manifest.files.forEach((entry, index) => {
    for (const field of REQUIRED_FILE_FIELDS) {
      if (!(field in entry)) fail(file, `files[${index}] missing required field "${field}"`);
    }
    if ("asset" in entry) {
      if (!("url" in entry)) fail(file, `files[${index}] has "asset" but no "url"`);
      if ("content" in entry) fail(file, `files[${index}] has "asset" and inlined "content" (assets must use url, never content)`);
    }
  });
}

async function findComponentManifests(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      found.push(...(await findComponentManifests(join(dir, entry.name))));
    } else if (entry.name === "component.json") {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

async function validateSourceManifest(file) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  validateShape(file, manifest);

  if (manifest.meta?.hidden === true && manifest.type !== "registry:lib") {
    fail(file, `"meta.hidden" is only supported on registry:lib items`);
  }

  const manifestDir = dirname(file);
  // src/registry/<group>/<name>/component.json
  const [group, name] = relative(join(root, "src/registry"), manifestDir).split("/");
  const ownFolder = `src/registry/${group}/${name}/`;
  const libFolder = "src/registry/lib/";

  for (const entry of manifest.files ?? []) {
    if ("content" in entry) {
      fail(file, `files entry for "${entry.path}" inlines "content" — source manifests must not inline content`);
    }
    if (typeof entry.path !== "string") continue;

    if (entry.type === "registry:lib") {
      if (!entry.path.startsWith(libFolder)) {
        fail(
          file,
          `shared lib file "${entry.path}" is not under "${libFolder}" (registry:lib files belong in src/registry/lib/<name>/)`,
        );
      }
    } else if (group !== "lib" && !entry.path.startsWith(ownFolder)) {
      fail(
        file,
        `files entry "${entry.path}" is not under its own component folder (expected to start with "${ownFolder}")`,
      );
    }
  }
}

async function validateGeneratedPayload(file) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  validateShape(file, manifest);

  for (const entry of manifest.files ?? []) {
    const isAsset = entry.asset === true || (typeof entry.path === "string" && isBinaryAssetPath(entry.path));

    if (isAsset) {
      if ("content" in entry) {
        fail(
          file,
          `binary asset file "${entry.path}" inlines "content" — binary files must never be inlined as JSON strings, use asset: true + url instead`,
        );
      }
      if (entry.asset === true && typeof entry.url !== "string") {
        fail(file, `asset file "${entry.path}" has "asset: true" but no "url"`);
      }
    } else if (typeof entry.content !== "string" || entry.content.length === 0) {
      fail(file, `text/code file "${entry.path}" is missing inlined "content"`);
    }
  }
}

async function main() {
  const sourceManifests = await findComponentManifests(join(root, "src/registry"));
  for (const file of sourceManifests) {
    await validateSourceManifest(file);
  }

  const generatedDir = join(root, "public/r");
  const generatedFiles = (await readdir(generatedDir))
    .filter((name) => name.endsWith(".json") && name !== "registry.json")
    .map((name) => join(generatedDir, name));
  for (const file of generatedFiles) {
    await validateGeneratedPayload(file);
  }

  const checked = sourceManifests.length + generatedFiles.length;
  if (errors.length > 0) {
    console.error(`✗ ${errors.length} problem(s) across ${checked} manifest(s):\n`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✓ ${checked} manifest(s) valid (${sourceManifests.length} source, ${generatedFiles.length} generated)`);
}

await main();
