# Motion Kit

A shadcn-compatible component registry of animated web components — install any of them into your own project with a single `shadcn add` command, browse and preview them all in a live Astro gallery.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:4321 — live preview/demo gallery
pnpm build        # production build → dist/
pnpm preview      # preview the production build
```

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
│   ├── <name>.json                #   Individual registry item payloads (what `shadcn add` fetches)
│   └── registry.json              #   Top-level registry manifest
│
├── registry.json                  # Root composed source registry (include-based)
│
├── packages/
│   └── motion-kit-cli/            # CLI package (init/add/list/build/info commands)
│       └── src/
│           ├── commands/          #   init, add, list, build, info
│           ├── producer/          #   discover, validate, generate registry artifacts
│           ├── config/            #   CLI config schema + I/O
│           └── detection/         #   framework & package-manager detection
│
├── templates/                     # Starter templates for supported frameworks
│   ├── astro/  nextjs/  nuxt/  sveltekit/  vite-react/  vue/
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
3. `public/r/<name>.json` mirrors each item as the static payload that `shadcn add` actually fetches, alongside `public/r/registry.json` as the top-level manifest.
4. Consumers install a component with:
   ```bash
   pnpm dlx shadcn@latest add <registry-url>/r/<name>.json
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
| `pnpm registry:build:check` | Same as above, in check-only mode |
