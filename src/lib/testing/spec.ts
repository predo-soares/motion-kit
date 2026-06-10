export const testFrameworks = ["Astro", "React", "Vue", "Svelte"] as const;

export type TestFramework = (typeof testFrameworks)[number];

interface ComponentTestCandidate {
  usage?: readonly {
    label: string;
    code: string;
  }[];
}

export interface ComponentTestRenderSpec {
  tagName: string;
  attributes: Record<string, string | true>;
  innerHTML: string;
}

export interface ComponentTestPageSpec {
  renderSpec: ComponentTestRenderSpec;
  frameworks: readonly TestFramework[];
}

export function getComponentTestSpec(
  component: ComponentTestCandidate,
): ComponentTestPageSpec | null {
  if (!component.usage?.length) return null;

  const labels = new Set(component.usage.map((tab) => tab.label));
  if (!testFrameworks.every((framework) => labels.has(framework))) {
    return null;
  }

  const astroUsage = component.usage.find((tab) => tab.label === "Astro");
  if (!astroUsage) return null;

  const renderSpec = parseAstroUsage(astroUsage.code);
  if (!renderSpec) return null;

  return {
    renderSpec: normalizeRenderSpec(renderSpec),
    frameworks: testFrameworks,
  };
}

export function renderSpecToHtml(spec: ComponentTestRenderSpec) {
  const attrs = Object.entries(spec.attributes)
    .map(([name, value]) =>
      value === true
        ? name
        : `${name}="${escapeAttribute(String(value))}"`,
    )
    .join(" ");

  const openTag = attrs.length
    ? `<${spec.tagName} ${attrs}>`
    : `<${spec.tagName}>`;

  return `${openTag}${spec.innerHTML}</${spec.tagName}>`;
}

function parseAstroUsage(code: string): ComponentTestRenderSpec | null {
  const markup = stripFrontmatter(code);
  const match = markup.match(
    /<(?<tag>motion-[a-z0-9-]+)\b(?<attrs>[\s\S]*?)(?:\/>|>(?<inner>[\s\S]*?)<\/\k<tag>>)/i,
  );

  if (!match?.groups?.tag) return null;

  return {
    tagName: match.groups.tag,
    attributes: parseAttributes(match.groups.attrs ?? ""),
    innerHTML: (match.groups.inner ?? "").trim(),
  };
}

function normalizeRenderSpec(spec: ComponentTestRenderSpec) {
  return {
    ...spec,
    attributes: Object.fromEntries(
      Object.entries(spec.attributes).map(([name, value]) => [
        name,
        normalizeTestAttribute(name, value),
      ]),
    ),
  };
}

function stripFrontmatter(code: string) {
  return code.replace(/^---[\s\S]*?---\s*/m, "").trim();
}

function parseAttributes(source: string) {
  const attributes: Record<string, string | true> = {};
  const pattern =
    /([:@A-Za-z0-9_-]+)(?:=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}))?/g;

  for (const match of source.matchAll(pattern)) {
    const rawName = match[1]?.trim();
    if (!rawName) continue;

    const name = normalizeAttributeName(rawName);
    const rawValue = match[2] ?? match[3] ?? match[4];

    if (rawValue === undefined) {
      attributes[name] = true;
      continue;
    }

    const value = normalizeAttributeValue(rawValue.trim());
    if (value === false) continue;
    attributes[name] = value;
  }

  return attributes;
}

function normalizeAttributeName(name: string) {
  if (name === "className") return "class";
  if (name.startsWith(":")) return name.slice(1);
  return name;
}

function normalizeAttributeValue(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;

  const quoted = value.match(/^["']([\s\S]*)["']$/);
  if (quoted) return quoted[1] ?? "";

  return value;
}

function normalizeTestAttribute(name: string, value: string | true) {
  if (value === true) return value;

  if (name === "logos") {
    return normalizeLogosValue(value);
  }

  return normalizeAssetValue(value);
}

function normalizeAssetValue(value: string) {
  if (value === "/images/your-image.jpg") {
    return "/images/demos/sample-8.jpg";
  }

  if (value === "https://example.com/video.mp4") {
    return "/images/demos/video.mp4";
  }

  if (value === "https://example.com/poster.jpg") {
    return "/images/demos/sample-10.jpg";
  }

  if (value.includes("picsum.photos")) {
    return "/images/demos/sample-9.jpg";
  }

  return value;
}

function normalizeLogosValue(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return value;

    return JSON.stringify(
      parsed.map((item, index) => {
        if (
          !item ||
          typeof item !== "object" ||
          typeof item.src !== "string" ||
          !item.src.startsWith("/logos/")
        ) {
          return item;
        }

        const labelSource =
          typeof item.name === "string"
            ? item.name
            : typeof item.alt === "string"
              ? item.alt
              : `Logo ${index + 1}`;

        return {
          ...item,
          src: createLogoDataUri(labelSource, index),
        };
      }),
    );
  } catch {
    return value;
  }
}

function createLogoDataUri(label: string, index: number) {
  const palettes = [
    ["#0f172a", "#f8fafc"],
    ["#1d4ed8", "#eff6ff"],
    ["#0f766e", "#ecfeff"],
    ["#7c3aed", "#f5f3ff"],
    ["#ea580c", "#fff7ed"],
    ["#be123c", "#fff1f2"],
  ] as const;
  const [background, foreground] = palettes[index % palettes.length];
  const text = label
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase() || "MK";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120" viewBox="0 0 240 120"><rect width="240" height="120" rx="28" fill="${background}"/><text x="50%" y="50%" fill="${foreground}" font-family="Arial, sans-serif" font-size="42" font-weight="700" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
