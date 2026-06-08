import type { RegistryItem, RegistryItemType } from "../producer/types.js";
import { itemGroup } from "./item-group.js";

export interface CatalogFilterOptions {
  all?: boolean;
  type?: RegistryItemType;
  group?: string;
}

export function isHiddenCatalogItem(item: RegistryItem): boolean {
  return item.meta?.hidden === true;
}

export function filterCatalogItems(
  items: RegistryItem[],
  options: CatalogFilterOptions,
): RegistryItem[] {
  let filtered = items;
  const includeHidden = options.all === true || options.type === "registry:lib";

  if (!includeHidden) {
    filtered = filtered.filter((item) => !isHiddenCatalogItem(item));
  }

  if (options.type) {
    filtered = filtered.filter((item) => item.type === options.type);
  }

  if (options.group) {
    filtered = filtered.filter((item) => itemGroup(item) === options.group);
  }

  return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
}

export function formatCatalogListItem(item: RegistryItem): string {
  const tags = [item.type.replace("registry:", "")];
  if (isHiddenCatalogItem(item)) {
    tags.push("hidden");
  }

  return `${item.name} (${tags.join(", ")}) — ${item.title}`;
}
