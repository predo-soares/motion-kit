import type { RegistryItem } from "../producer/types.js";

export function itemGroup(item: RegistryItem): string | null {
  for (const file of item.files) {
    const match = file.path.match(/^src\/registry\/([^/]+)\//);
    if (match) {
      return match[1]!;
    }
  }

  return null;
}
