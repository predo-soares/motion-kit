import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { RegistryItem } from "../producer/types.js";
import type { Logger } from "../utils/logger.js";

export interface PatchReactJsxTypesOptions {
  cwd: string;
  dryRun: boolean;
  logger: Logger;
  items: RegistryItem[];
}

export interface ReactCustomElementDefinition {
  tagName: string;
  props: Array<{ name: string; type: string }>;
}

function extractCustomElementTag(content: string): string | null {
  return content.match(/@customElement\(\s*["']([^"']+)["']\s*\)/)?.[1] ?? null;
}

function reactPropType(type: string): string {
  const normalized = type.toLowerCase();

  if (normalized === "number" || normalized === "integer") {
    return "number | string";
  }

  if (normalized === "boolean") {
    return "boolean | string";
  }

  return "string";
}

function formatPropName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function formatElementEntry(definition: ReactCustomElementDefinition, indent = "      "): string {
  const propIndent = `${indent}  `;
  const props = definition.props
    .map((prop) => `${propIndent}${formatPropName(prop.name)}?: ${reactPropType(prop.type)};`)
    .join("\n");

  return `${indent}${JSON.stringify(definition.tagName)}: DetailedHTMLProps<
${indent}  HTMLAttributes<HTMLElement>,
${indent}  HTMLElement
${indent}> & {${props ? `\n${props}\n${indent}` : ""}};`;
}

function findMatchingBrace(content: string, openBraceIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = openBraceIndex; index < content.length; index += 1) {
    const char = content[index]!;

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function replaceExistingEntry(
  content: string,
  definition: ReactCustomElementDefinition,
): { content: string; changed: boolean } {
  const quotedTagPattern = new RegExp(`["']${definition.tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:`);
  const tagMatch = quotedTagPattern.exec(content);
  if (tagMatch?.index === undefined) {
    return { content, changed: false };
  }

  const entryStart = content.lastIndexOf("\n", tagMatch.index) + 1;
  const entryIndent = content.slice(entryStart, tagMatch.index).match(/^\s*/)?.[0] ?? "";
  const propsOpen = content.indexOf("{", tagMatch.index);
  if (propsOpen === -1) {
    return { content, changed: false };
  }

  const propsClose = findMatchingBrace(content, propsOpen);
  if (propsClose === -1) {
    return { content, changed: false };
  }

  const semicolonIndex = content.indexOf(";", propsClose);
  const entryEnd = semicolonIndex === -1 ? propsClose + 1 : semicolonIndex + 1;
  const nextContent = `${content.slice(0, entryStart)}${formatElementEntry(
    definition,
    entryIndent,
  )}${content.slice(entryEnd)}`;

  return { content: nextContent, changed: nextContent !== content };
}

function ensureReactImports(content: string): string {
  const reactTypeImport = content.match(/import\s+type\s+\{([^}]+)\}\s+from\s+["']react["']/);
  const importedNames = reactTypeImport?.[1] ?? "";

  if (/\bDetailedHTMLProps\b/.test(importedNames) && /\bHTMLAttributes\b/.test(importedNames)) {
    return content;
  }

  return `import type { DetailedHTMLProps, HTMLAttributes } from "react";\n\n${content}`;
}

function formatModuleBlock(definitions: ReactCustomElementDefinition[]): string {
  return `declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
${definitions.map((definition) => formatElementEntry(definition)).join("\n")}
    }
  }
}
`;
}

export function resolveReactCustomElementDefinitions(
  items: RegistryItem[],
): ReactCustomElementDefinition[] {
  const definitions = new Map<string, ReactCustomElementDefinition>();

  for (const item of items) {
    for (const file of item.files) {
      if (!file.content) {
        continue;
      }

      const tagName = extractCustomElementTag(file.content);
      if (!tagName) {
        continue;
      }

      definitions.set(tagName, {
        tagName,
        props: (item.props ?? []).map((prop) => ({
          name: prop.name,
          type: prop.type,
        })),
      });
    }
  }

  return [...definitions.values()].sort((a, b) => a.tagName.localeCompare(b.tagName));
}

export async function ensureReactJsxCustomElements(
  options: PatchReactJsxTypesOptions,
): Promise<{ patched: boolean; path?: string; skippedReason?: string }> {
  const definitions = resolveReactCustomElementDefinitions(options.items);
  if (definitions.length === 0) {
    return { patched: false, skippedReason: "no custom elements found" };
  }

  const path = join(options.cwd, "src", "custom-elements.d.ts");
  const label = relative(options.cwd, path) || path;
  let content = existsSync(path) ? await readFile(path, "utf-8") : "";
  let changed = !content;
  const missingDefinitions: ReactCustomElementDefinition[] = [];

  for (const definition of definitions) {
    if (content.includes(`"${definition.tagName}"`) || content.includes(`'${definition.tagName}'`)) {
      const patched = replaceExistingEntry(content, definition);
      content = patched.content;
      changed ||= patched.changed;
      continue;
    }

    missingDefinitions.push(definition);
  }

  if (missingDefinitions.length > 0) {
    content = `${content.trimEnd()}${content.trimEnd() ? "\n\n" : ""}${formatModuleBlock(
      missingDefinitions,
    )}`;
    changed = true;
  }

  if (!changed) {
    return { patched: false, path: label, skippedReason: "already configured" };
  }

  content = ensureReactImports(content).trimEnd() + "\n";

  if (options.dryRun) {
    options.logger.info(`would add React JSX custom element types to ${label}`);
    return { patched: true, path: label };
  }

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf-8");
  options.logger.info(`added React JSX custom element types to ${label}`);
  return { patched: true, path: label };
}
