# Motion Kit

A component registry of animated web components — install any of them into your own project with the `motion-kit` CLI, browse and preview them all in a live Astro gallery.

## Quick start (site)

```bash
pnpm install
pnpm dev          # http://localhost:4321 — live preview/demo gallery
pnpm build        # production build → dist/
pnpm preview      # preview the production build
```

## Quick start (consumers)

Install components into your own project with the Motion Kit CLI:

```bash
pnpm dlx motion-kit init
pnpm dlx motion-kit add magnetic
```

Browse available items:

```bash
pnpm dlx motion-kit list
pnpm dlx motion-kit list --all    # include hidden helper libs
pnpm dlx motion-kit info
```

Motion Kit reads **`motion-kit.json` only**. It does not read or write shadcn `components.json`.

## Project structure

```
motion-kit-astro/
├── src/
│   ├── registry/                  # Component source — one folder per component
│   │   ├── canvas/                #   WebGL/canvas-driven effects (god-rays, globe, fluid-simulation, ...)
│   │   ├── interaction/           #   Pointer/scroll-driven interactions (magnetic, marquee, card-stack, ...)
│   │   ├── showcase/              #   Larger composed showcase pieces (galleries, sliders, video player)
│   │   ├── text/                  #   Text/typography effects (text-loop, split-reveal, weight-wave, ...)
│   │   └── <group>/registry.json  #   Include-based manifest listing the group's published items
│   │
│   ├── pages/
│   │   ├── index.astro            # Live preview/demo gallery (imports & registers every component)
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
│   └── motion-kit-cli/            # CLI package (init/add/list/build/info commands)
│       └── src/
│           ├── commands/          #   init, add, list, build, info
│           ├── producer/          #   discover, validate, generate registry artifacts
│           ├── config/            #   motion-kit.json schema + I/O
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
2. Group-level `src/registry/<group>/registry.json` files include published components into the composed source registry (`registry.json` at the root).
3. `public/r/<name>.json` mirrors each item as the static payload the CLI fetches, alongside `public/r/registry.json` as the top-level manifest.
4. Consumers install a component with:
   ```bash
   pnpm dlx motion-kit init
   pnpm dlx motion-kit add magnetic
   ```

See `CLAUDE.md` for the detailed authoring conventions and the steps for adding a new component.

## Useful scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Astro dev server (preview/demo gallery) |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build |
| `pnpm registry:validate` | Validate the registry source against the schema |
| `pnpm registry:build` | Build the CLI and regenerate registry artifacts (run manually by maintainers) |
| `pnpm registry:build:check` | Same as above, in check-only mode (`motion-kit build --check`) |

## CLI development

From the monorepo root:

```bash
pnpm --filter motion-kit-cli build
node packages/motion-kit-cli/dist/index.js --help
node packages/motion-kit-cli/dist/index.js add magnetic --dry-run --cwd templates/astro
```

See `packages/motion-kit-cli/RELEASE.md` for the pre-publish checklist.
