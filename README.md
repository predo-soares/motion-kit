# Motion Blocks

A component registry of animated web components — install any of them into your own project with the `motion-blocks` CLI, browse and preview them all in a live Astro gallery.

## Quick start (site)

```bash
pnpm install
pnpm dev          # http://localhost:4321 — live preview/demo gallery
pnpm build        # production build → dist/
pnpm preview      # preview the production build
```

## Quick start (consumers)

Install components into your own project with the Motion Blocks CLI:

```bash
# pnpm
pnpm dlx motion-blocks init
pnpm dlx motion-blocks add magnetic

# npm
npx motion-blocks init
npx motion-blocks add magnetic

# yarn
yarn dlx motion-blocks init
yarn dlx motion-blocks add magnetic

# bun
bunx --bun motion-blocks init
bunx --bun motion-blocks add magnetic
```

Browse available items:

```bash
# pnpm
pnpm dlx motion-blocks list
pnpm dlx motion-blocks list --all    # include hidden helper libs
pnpm dlx motion-blocks info

# npm
npx motion-blocks list
npx motion-blocks list --all
npx motion-blocks info

# yarn
yarn dlx motion-blocks list
yarn dlx motion-blocks list --all
yarn dlx motion-blocks info

# bun
bunx --bun motion-blocks list
bunx --bun motion-blocks list --all
bunx --bun motion-blocks info
```

Motion Blocks reads **`motion-blocks.json` only**.

## Project structure

```
motion-blocks/
├── src/
│   ├── registry/                  # Component source — one folder per component
│   │   ├── canvas/                #   WebGL/canvas-driven effects (god-rays, globe, fluid-simulation, ...)
│   │   ├── interaction/           #   Pointer/scroll-driven interactions (magnetic, marquee, card-stack, ...)
│   │   ├── showcase/              #   Larger composed showcase pieces (galleries, sliders, video player)
│   │   ├── text/                  #   Text/typography effects (text-loop, split-reveal, weight-wave, ...)
│   │   └── <group>/registry.json  #   Include-based manifest listing the group's published items
│   │
│   ├── pages/
│   │   ├── index.astro            # Live preview/demo gallery
│   │   └── docs/                  # Docs site (introduction, installation, components, changelog)
│   │
│   ├── components/
│   │   ├── ui/                    # Primitive components (e.g. component-card)
│   │   ├── docs/                  # Docs-site chrome (nav, sidebar, TOC, preview scripts)
│   │   ├── demos/                 # Demo wrappers for the gallery
│   │   └── tests/                 # Cross-framework test hosts (React/Svelte/Vue)
│   │
│   ├── layouts/                   # Astro layouts
│   ├── content/changelog/         # Changelog content collection
│   ├── styles/                    # Tailwind v4 config (global.css, @theme tokens)
│   │
│   └── lib/
│       ├── utils/                 # cn() and other small utilities
│       ├── helpers/               # gsap.ts, color.ts, fluid-pointer.ts, svg-sdf.ts
│       ├── audio/, testing/       # UI audio + DOM/spec test helpers
│       └── catalog.ts, changelog.ts
│
├── public/r/                      # Static registry JSON served to consumers
│   ├── <name>.json                #   Individual registry item payloads
│   └── registry.json              #   Top-level registry manifest
│
├── registry.json                  # Root composed source registry (include-based)
│
├── packages/
│   └── motion-blocks/             # CLI package (init/add/list/build/info commands)
│       └── src/
│           ├── commands/          #   init, add, list, build, info
│           ├── producer/          #   discover, validate, generate registry artifacts
│           ├── config/            #   motion-blocks.json schema + I/O
│           └── detection/         #   framework & package-manager detection
│
├── templates/                     # Starter templates for supported frameworks
│   ├── astro/  nextjs/  sveltekit/  vite-react/  vue/
│
├── scripts/
│   └── validate-registry.mjs      # Registry validation script (pnpm registry:validate)
│
├── ref/motion-core/               # Read-only Svelte 5 reference library (migration source, not built)
│
└── thoughts/
    ├── plans/                     # Implementation plans (e.g. CLI milestone plans)
    ├── research/                  # Research write-ups (migration trade-offs, CLI research)
    └── progress.txt               # Running log of completed milestones
```

## How the registry works

1. Each component lives in `src/registry/<group>/<name>/` as a Web Component (Lit `LitElement` or vanilla `HTMLElement`), with an opt-in `component.json` manifest describing its registry metadata.
2. Group-level `src/registry/<group>/registry.json` files include published items into the composed source registry (`registry.json` at the root).
3. `motion-blocks build` validates the published item graph and regenerates `public/r/<name>.json` plus `public/r/registry.json`. Text files get inlined as `content`; assets get generated `url` entries.
4. The docs catalog, component navigation, and preview registration data derive from the published registry item model. Visible components need `src/components/demos/<name>-demo.astro`; preview registrations are derived from `-element.ts` files unless `meta.docs.previewRegistrations` is needed for supporting elements.
5. Hidden helper libraries use `type: "registry:lib"` with `meta.hidden: true`. They stay out of normal docs browsing and `motion-blocks list`, but remain available through `motion-blocks list --all`, `--type registry:lib`, and `registryDependencies`.
6. Consumers install a component with:
   ```bash
   pnpm dlx motion-blocks init
   pnpm dlx motion-blocks add magnetic
   ```
   The CLI fetches the static payload, resolves registry dependencies, writes files to their `target` paths, and installs npm dependencies unless disabled.

See `AGENTS.md` and `packages/motion-blocks/README.md` for detailed authoring and publishing conventions.

## Useful scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Astro dev server (preview/demo gallery) |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm registry:validate` | Validate the registry source against the schema |
| `pnpm registry:build` | Build the CLI and regenerate registry artifacts (run manually by maintainers) |
| `pnpm registry:build:check` | Same as above, in check-only mode (`motion-blocks build --check`) |

## CLI development

From the monorepo root:

```bash
pnpm --filter motion-blocks build
node packages/motion-blocks/dist/index.js --help
node packages/motion-blocks/dist/index.js add magnetic --dry-run --cwd templates/astro
```

See `packages/motion-blocks/RELEASE.md` for the pre-publish checklist.
