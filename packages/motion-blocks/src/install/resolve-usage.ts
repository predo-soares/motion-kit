import type { Framework } from "../config/types.js";
import type { MotionBlocksConfig } from "../config/types.js";
import type { RegistryFile, RegistryItem, UsageEntry } from "../producer/types.js";
import { resolveWriteTarget } from "./resolve-target.js";

export const KNOWN_USAGE_LABELS = ["Astro", "React", "Vue", "Svelte", "HTML"] as const;
export type KnownUsageLabel = (typeof KNOWN_USAGE_LABELS)[number];

const FRAMEWORK_TO_LABEL: Record<Framework, KnownUsageLabel> = {
  astro: "Astro",
  next: "React",
  react: "React",
  vue: "Vue",
  nuxt: "Vue",
  svelte: "Svelte",
  sveltekit: "Svelte",
  plain: "HTML",
};

export function usageLabelForFramework(framework: Framework): KnownUsageLabel {
  return FRAMEWORK_TO_LABEL[framework];
}

export function isKnownUsageLabel(label: string): label is KnownUsageLabel {
  return (KNOWN_USAGE_LABELS as readonly string[]).includes(label);
}

export function selectUsageEntry(
  usage: UsageEntry[] | undefined,
  framework: Framework,
): UsageEntry | null {
  if (!usage?.length) {
    return null;
  }

  const preferredLabel = usageLabelForFramework(framework);
  return usage.find((entry) => entry.label === preferredLabel) ?? null;
}

export function toAliasPath(target: string): string {
  const normalized = target.replace(/\\/g, "/");
  if (normalized.startsWith("src/")) {
    return `@/${normalized.slice(4)}`;
  }
  return normalized;
}

export interface PathRewrite {
  from: string;
  to: string;
}

function toHtmlModulePath(target: string): string {
  const normalized = target.replace(/\\/g, "/").replace(/\.ts$/, ".js");
  if (normalized.startsWith("src/")) {
    return `/${normalized.slice(4)}`;
  }
  return `/${normalized}`;
}

export function buildPathRewrites(
  files: RegistryFile[],
  config: MotionBlocksConfig,
): PathRewrite[] {
  const rewrites: PathRewrite[] = [];

  for (const file of files) {
    if (file.asset === true) {
      continue;
    }

    const original = file.target.replace(/\\/g, "/");
    const resolved = resolveWriteTarget(file, config);
    if (original === resolved) {
      continue;
    }

    rewrites.push({ from: original, to: resolved });

    const originalAlias = toAliasPath(original);
    const resolvedAlias = toAliasPath(resolved);
    if (originalAlias !== resolvedAlias) {
      rewrites.push({ from: originalAlias, to: resolvedAlias });
    }

    const originalHtml = toHtmlModulePath(original);
    const resolvedHtml = toHtmlModulePath(resolved);
    if (originalHtml !== resolvedHtml) {
      rewrites.push({ from: originalHtml, to: resolvedHtml });
    }
  }

  return rewrites;
}

export function rewriteUsageImports(code: string, rewrites: PathRewrite[]): string {
  let result = code;
  const sorted = [...rewrites].sort((a, b) => b.from.length - a.from.length);

  for (const { from, to } of sorted) {
    result = result.split(from).join(to);
  }

  return result;
}

function extractCustomElementTag(content: string, itemName: string): string {
  const customElementMatch = content.match(/@customElement\(["']([^"']+)["']\)/);
  if (customElementMatch?.[1]) {
    return customElementMatch[1];
  }

  const defineMatch = content.match(/customElements\.define\(["']([^"']+)["']/);
  if (defineMatch?.[1]) {
    return defineMatch[1];
  }

  return `motion-${itemName}`;
}

function extractExampleMarkup(code: string): string | null {
  const markup = code.replace(/^---[\s\S]*?---\s*/m, "").trim();
  const match = markup.match(/<motion-[a-z0-9-]+[\s\S]*?(?:\/>|>[\s\S]*?<\/motion-[a-z0-9-]+>)/i);
  return match?.[0] ?? null;
}

export function buildCustomElementFallback(
  item: RegistryItem,
  files: RegistryFile[],
  config: MotionBlocksConfig,
): string {
  const componentFiles = files.filter((file) => file.type === "registry:component" && file.asset !== true);
  const imports = componentFiles
    .map((file) => `import "${toAliasPath(resolveWriteTarget(file, config))}";`)
    .join("\n");

  for (const entry of item.usage ?? []) {
    const example = extractExampleMarkup(entry.code);
    if (example) {
      return `${imports}\n\n${example}`;
    }
  }

  const primary = componentFiles[0];
  if (primary?.content) {
    const tag = extractCustomElementTag(primary.content, item.name);
    return `${imports}\n\n<${tag}></${tag}>`;
  }

  return imports;
}

export interface ResolvedUsage {
  label: string;
  code: string;
  source: "matched" | "fallback" | "generic";
}

export function resolveUsageSnippet(
  item: RegistryItem,
  config: MotionBlocksConfig,
): ResolvedUsage | null {
  const framework = config.framework ?? "plain";
  const rewrites = buildPathRewrites(item.files, config);
  const rewrite = (code: string) => rewriteUsageImports(code, rewrites);

  if (item.type !== "registry:component") {
    if (!item.usage?.length) {
      return null;
    }

    const first = item.usage[0]!;
    return {
      label: first.label,
      code: rewrite(first.code),
      source: "generic",
    };
  }

  const selected = selectUsageEntry(item.usage, framework);
  if (selected) {
    return {
      label: selected.label,
      code: rewrite(selected.code),
      source: "matched",
    };
  }

  const htmlEntry = item.usage?.find((entry) => entry.label === "HTML");
  if (htmlEntry) {
    return {
      label: "HTML",
      code: rewrite(htmlEntry.code),
      source: "fallback",
    };
  }

  return {
    label: "Custom Element",
    code: buildCustomElementFallback(item, item.files, config),
    source: "fallback",
  };
}

export function formatUsageOutput(usage: ResolvedUsage): string {
  return `\nUsage (${usage.label}):\n\n${usage.code}`;
}
