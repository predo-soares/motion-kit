type ComponentGroup = "Interaction" | "Text" | "Showcase" | "WebGL";

interface ComponentManifestFile {
  path: string;
  type: string;
  target: string;
}

interface ComponentManifest {
  name: string;
  title: string;
  description: string;
  dependencies?: string[];
  files: ComponentManifestFile[];
}

interface ComponentSeed {
  slug: string;
  group: ComponentGroup;
}

export interface ComponentCatalogEntry {
  slug: string;
  group: ComponentGroup;
  title: string;
  summary: string;
  dependencies: string[];
  files: ComponentManifestFile[];
}

export interface ComponentCatalogGroup {
  name: ComponentGroup;
  items: ComponentCatalogEntry[];
}

const manifestModules = import.meta.glob<ComponentManifest>(
  "../registry/new-york/blocks/*/component.json",
  { eager: true, import: "default" },
);

const manifestsBySlug = Object.fromEntries(
  Object.values(manifestModules).map((manifest) => [manifest.name, manifest]),
) as Record<string, ComponentManifest>;

const seeds: ComponentSeed[] = [
  { slug: "card-stack", group: "Interaction" },
  { slug: "magnetic", group: "Interaction" },
  { slug: "magnetic-lit", group: "Interaction" },
  { slug: "marquee", group: "Interaction" },
  { slug: "text-loop", group: "Text" },
  { slug: "text-scramble", group: "Text" },
  { slug: "text-repel", group: "Text" },
  { slug: "weight-wave", group: "Text" },
  { slug: "split-hover", group: "Text" },
  { slug: "split-reveal", group: "Text" },
  { slug: "stacking-words", group: "Text" },
  { slug: "logo-carousel", group: "Showcase" },
  { slug: "slideshow", group: "Showcase" },
  { slug: "radial-gallery", group: "Showcase" },
  { slug: "infinite-physics-gallery", group: "Showcase" },
  { slug: "video-player", group: "Showcase" },
  { slug: "card-3d", group: "WebGL" },
  { slug: "dithered-image", group: "WebGL" },
  { slug: "fake-3d-image", group: "WebGL" },
  { slug: "fluid-simulation", group: "WebGL" },
  { slug: "fluid-image-reveal", group: "WebGL" },
  { slug: "glass-logo", group: "WebGL" },
  { slug: "glass-pane", group: "WebGL" },
  { slug: "ascii-renderer", group: "WebGL" },
];

const groupOrder: ComponentGroup[] = [
  "Interaction",
  "Text",
  "Showcase",
  "WebGL",
];

export const componentCatalog: ComponentCatalogEntry[] = seeds.map(
  ({ slug, group }) => {
    const manifest = manifestsBySlug[slug];

    if (!manifest) {
      throw new Error(`Missing component manifest for "${slug}".`);
    }

    return {
      slug,
      group,
      title: manifest.title,
      summary: manifest.description,
      dependencies: manifest.dependencies ?? [],
      files: manifest.files,
    };
  },
);

export const componentGroups: ComponentCatalogGroup[] = groupOrder.map(
  (group) => ({
    name: group,
    items: componentCatalog.filter((component) => component.group === group),
  }),
);

export const firstComponent = componentCatalog[0];

export function getComponentBySlug(slug: string) {
  return componentCatalog.find((component) => component.slug === slug);
}
