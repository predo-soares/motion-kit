import rootRegistry from "../../registry.json";

type ComponentGroup = "Canvas" | "Interaction" | "Showcase" | "Text";

interface SourceRegistry {
  items?: Array<{
    name: string;
    meta?: RegistryMeta;
  }>;
}

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

interface RegistryMeta {
  hidden?: boolean;
  docs?: {
    order?: number;
    previewRegistrations?: string[];
  };
}

interface ComponentManifest {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies?: string[];
  files: ComponentManifestFile[];
  usage?: UsageTab[];
  props?: PropEntry[];
  meta?: RegistryMeta;
}

export interface PreviewRegistration {
  path: string;
}

export interface PublishedRegistryItem {
  slug: string;
  group: ComponentGroup;
  order: number;
  title: string;
  summary: string;
  dependencies: string[];
  files: ComponentManifestFile[];
  usage?: UsageTab[];
  props?: PropEntry[];
  hidden: boolean;
  previewRegistrations: PreviewRegistration[];
}

export type ComponentCatalogEntry = PublishedRegistryItem;

export interface ComponentCatalogGroup {
  name: ComponentGroup;
  items: ComponentCatalogEntry[];
}

const manifestModules = import.meta.glob<ComponentManifest>(
  "../registry/**/*/component.json",
  { eager: true, import: "default" },
);

const sourceRegistryModules = import.meta.glob<SourceRegistry>(
  "../registry/*/registry.json",
  { eager: true, import: "default" },
);

const manifestsBySlug = new Map<string, ComponentManifest>();

for (const manifest of Object.values(manifestModules)) {
  manifestsBySlug.set(manifest.name, manifest);
}

const groupLabelBySourceGroup: Record<string, ComponentGroup> = {
  canvas: "Canvas",
  interaction: "Interaction",
  showcase: "Showcase",
  text: "Text",
};

const publishedItems = buildPublishedRegistryItems();

export const componentCatalog: ComponentCatalogEntry[] = publishedItems.filter(
  (item) => !item.hidden,
);

export const componentGroups: ComponentCatalogGroup[] = Object.values(
  groupLabelBySourceGroup,
)
  .map((group) => ({
    name: group,
    items: componentCatalog.filter((component) => component.group === group),
  }))
  .filter((group) => group.items.length > 0);

function buildPublishedRegistryItems(): PublishedRegistryItem[] {
  const items: PublishedRegistryItem[] = [];

  for (const includePath of rootRegistry.include) {
    const sourceGroup = getGroupNameFromIncludePath(includePath);
    const group = groupLabelBySourceGroup[sourceGroup];
    if (!group) continue;

    const sourceRegistry =
      sourceRegistryModules[`../${includePath.replace(/^src\//, "")}`];
    if (!sourceRegistry) {
      throw new Error(`Missing composed source registry "${includePath}".`);
    }

    sourceRegistry.items?.forEach((sourceItem, index) => {
      const manifest = manifestsBySlug.get(sourceItem.name);
      if (!manifest) {
        throw new Error(
          `Missing component manifest for published item "${sourceItem.name}".`,
        );
      }

      if (manifest.type !== "registry:component") return;

      const hidden = manifest.meta?.hidden === true;
      const explicitOrder = manifest.meta?.docs?.order;

      items.push({
        slug: manifest.name,
        group,
        order: typeof explicitOrder === "number" ? explicitOrder : index,
        title: manifest.title,
        summary: manifest.description,
        dependencies: manifest.dependencies ?? [],
        files: manifest.files,
        usage: manifest.usage,
        props: manifest.props,
        hidden,
        previewRegistrations: getManifestPreviewRegistrations(manifest),
      });
    });
  }

  return items.sort((a, b) => {
    if (a.group !== b.group) {
      return (
        Object.values(groupLabelBySourceGroup).indexOf(a.group) -
        Object.values(groupLabelBySourceGroup).indexOf(b.group)
      );
    }
    return a.order - b.order || a.title.localeCompare(b.title);
  });
}

function getManifestPreviewRegistrations(
  manifest: ComponentManifest,
): PreviewRegistration[] {
  const explicit = manifest.meta?.docs?.previewRegistrations;
  const paths = explicit?.length
    ? explicit
    : manifest.files
        .filter(
          (file) =>
            file.type === "registry:component" &&
            file.path.endsWith("-element.ts"),
        )
        .map((file) => file.path);

  return paths.map((path) => ({ path }));
}

function getGroupNameFromIncludePath(includePath: string) {
  const parts = includePath.split("/");
  return parts.at(-2) ?? "";
}
