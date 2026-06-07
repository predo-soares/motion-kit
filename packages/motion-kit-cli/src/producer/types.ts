export type RegistryItemType = "registry:component" | "registry:lib" | "registry:file";

export interface RegistryFile {
  path: string;
  type: RegistryItemType;
  target: string;
  content?: string;
  asset?: boolean;
  url?: string;
}

export interface UsageEntry {
  label: string;
  code: string;
}

export interface PropEntry {
  name: string;
  type: string;
  default: string;
  description: string;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: RegistryItemType;
  title: string;
  description: string;
  author?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  docs?: string;
  categories?: string[];
  meta?: Record<string, unknown>;
  files: RegistryFile[];
  usage?: UsageEntry[];
  props?: PropEntry[];
}

export interface DiscoveredItem {
  /** The item as read from its source of truth (component.json when present, group registry.json otherwise). */
  item: RegistryItem;
  /** Registry group, e.g. "interaction" — derived from the include path. */
  group: string;
  /** Absolute path to the manifest this item's data was read from. */
  manifestPath: string;
  /** Whether `item` came from a per-component component.json (the opt-in source of truth). */
  hasOwnManifest: boolean;
}
