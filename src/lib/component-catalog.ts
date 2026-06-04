type ComponentGroup = "Canvas" | "Interaction" | "Showcase" | "Text";

interface ComponentManifestFile {
  path: string;
  type: string;
  target: string;
}

export interface PropEntry {
  name: string;
  type: string;
  default: string;
  description: string;
}

export interface UsageTab {
  label: string;
  code: string;
}

interface ComponentManifest {
  name: string;
  title: string;
  description: string;
  dependencies?: string[];
  files: ComponentManifestFile[];
  usage?: UsageTab[];
  props?: PropEntry[];
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
  usage?: UsageTab[];
  props?: PropEntry[];
}

export interface ComponentCatalogGroup {
  name: ComponentGroup;
  items: ComponentCatalogEntry[];
}

const manifestModules = import.meta.glob<ComponentManifest>(
  "../registry/**/*/component.json",
  { eager: true, import: "default" },
);

const manifestsBySlug = Object.fromEntries(
  Object.values(manifestModules).map((manifest) => [manifest.name, manifest]),
) as Record<string, ComponentManifest>;

const seeds: ComponentSeed[] = [
  { slug: "card-stack", group: "Interaction" },
  { slug: "flip-card-stack", group: "Interaction" },
  { slug: "flip-grid", group: "Interaction" },
  { slug: "floating-menu", group: "Interaction" },
  { slug: "image-trail", group: "Interaction" },
  { slug: "magnetic", group: "Interaction" },
  { slug: "marquee", group: "Interaction" },
  { slug: "velocity-card", group: "Interaction" },
  { slug: "split-hover", group: "Text" },
  { slug: "split-reveal", group: "Text" },
  { slug: "stacking-words", group: "Text" },
  { slug: "text-loop", group: "Text" },
  { slug: "text-scramble", group: "Text" },
  { slug: "text-repel", group: "Text" },
  { slug: "weight-wave", group: "Text" },
  { slug: "infinite-gallery", group: "Showcase" },
  { slug: "infinite-physics-gallery", group: "Showcase" },
  { slug: "logo-carousel", group: "Showcase" },
  { slug: "radial-gallery", group: "Showcase" },
  { slug: "slideshow", group: "Showcase" },
  { slug: "video-player", group: "Showcase" },
  { slug: "ascii-renderer", group: "Canvas" },
  { slug: "lava-lamp", group: "Canvas" },
  { slug: "rubiks-cube", group: "Canvas" },
  { slug: "neural-noise", group: "Canvas" },
  { slug: "plasma-grid", group: "Canvas" },
  { slug: "specular-band", group: "Canvas" },
  { slug: "interactive-grid", group: "Canvas" },
  { slug: "water-ripple", group: "Canvas" },
  { slug: "card-3d", group: "Canvas" },
  { slug: "dithered-image", group: "Canvas" },
  { slug: "fake-3d-image", group: "Canvas" },
  { slug: "fluid-image-reveal", group: "Canvas" },
  { slug: "fluid-simulation", group: "Canvas" },
  { slug: "glass-logo", group: "Canvas" },
  { slug: "glass-pane", group: "Canvas" },
  { slug: "glass-slideshow", group: "Canvas" },
  { slug: "glitter-cloth", group: "Canvas" },
  { slug: "globe", group: "Canvas" },
  { slug: "god-rays", group: "Canvas" },
  { slug: "halo", group: "Canvas" },
  { slug: "pixelated-image", group: "Canvas" },
];

const groupOrder: ComponentGroup[] = [
  "Canvas",
  "Interaction",
  "Showcase",
  "Text",
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
      usage: manifest.usage,
      props: manifest.props,
    };
  },
);

export const componentGroups: ComponentCatalogGroup[] = groupOrder.map(
  (group) => ({
    name: group,
    items: componentCatalog
      .filter((component) => component.group === group)
      .sort((a, b) =>
        group === "Canvas" ? a.title.localeCompare(b.title) : 0,
      ),
  }),
);

export const firstComponent = componentCatalog[0];

export function getComponentBySlug(slug: string) {
  return componentCatalog.find((component) => component.slug === slug);
}
