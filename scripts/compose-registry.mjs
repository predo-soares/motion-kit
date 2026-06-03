import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const blocksDir = path.join(repoRoot, "src/registry");
const rootRegistryPath = path.join(repoRoot, "registry.json");
const publicRegistryPath = path.join(repoRoot, "public/r/registry.json");

const registryMeta = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "motion-kit-astro",
  homepage: "http://localhost:4321",
};

async function readComponentManifest(blockName) {
  const manifestPath = path.join(blocksDir, blockName, "component.json");
  let raw;

  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }

  const manifest = JSON.parse(raw);

  const leafName = path.basename(blockName);
  if (manifest.name !== leafName) {
    throw new Error(
      `Component manifest name mismatch for "${blockName}": found "${manifest.name}".`,
    );
  }

  return manifest;
}

async function collectBlockNames() {
  const groups = (await readdir(blocksDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const names = [];
  for (const group of groups) {
    const entries = await readdir(path.join(blocksDir, group), { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) names.push(path.join(group, entry.name));
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
}

async function main() {
  const blockNames = await collectBlockNames();

  const manifests = (await Promise.all(blockNames.map(readComponentManifest))).filter(
    Boolean,
  );
  const items = manifests.map(({ $schema: _schema, ...manifest }) => manifest);
  const registry = { ...registryMeta, items };
  const formatted = `${JSON.stringify(registry, null, 2)}\n`;

  await Promise.all([
    writeFile(rootRegistryPath, formatted),
    writeFile(publicRegistryPath, formatted),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
