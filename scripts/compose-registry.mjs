import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const blocksDir = path.join(repoRoot, "src/registry/new-york/blocks");
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

  if (manifest.name !== blockName) {
    throw new Error(
      `Component manifest name mismatch for "${blockName}": found "${manifest.name}".`,
    );
  }

  return manifest;
}

async function main() {
  const dirEntries = await readdir(blocksDir, { withFileTypes: true });
  const blockNames = dirEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

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
