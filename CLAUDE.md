# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server (http://localhost:4321)
pnpm build        # production build → dist/
pnpm preview      # preview built output
```

> **Note:** The dev server is always running at http://localhost:4321 — never start it or ask to restart it. `pnpm registry:build` is reserved for the user to run manually.

## What this project is

`motion-kit-astro` is a **Motion Kit-owned component registry** that hosts animated web components for installation via the `motion-kit` CLI. The Astro site (`src/pages/index.astro`) is a live preview/demo gallery; the actual distributable artifacts are:

- **Registry source:** `src/registry/<group>/<name>/` — one directory per component
- **Static JSON served to consumers:** `public/r/<name>.json` + `public/r/registry.json`
- **Component manifest:** `src/registry/<group>/<name>/component.json` — opt-in source of truth for a published item
- **Composed source registries:** `registry.json` at the root plus `src/registry/<group>/registry.json` — include-based manifests
- **CLI config:** `motion-kit.json` in consumer projects — the only config file the CLI reads

When a consumer runs `motion-kit add`, they receive the files listed under `"files"` in the registry payload, installed at the `"target"` paths in their project.

The v0 schema inherits field names from shadcn's registry format where they overlap, but Motion Kit narrows the contract to what the CLI and docs site actually use. Motion Kit does **not** read shadcn `components.json`.

## Architecture

### Component authoring model

All distributable motion components are **Web Components** (Custom Elements), not `.astro` files. Two patterns are used:

1. **Lit-based** (`LitElement` + `@customElement` decorator) — most components. Shadow DOM isolates GSAP logic and styles. `firstUpdated()` is the mount hook; `disconnectedCallback()` calls `gsap.context.revert()` for cleanup. Examples: `magnetic-lit`, `card-stack`, `text-loop`.
2. **Vanilla Custom Element** (extends `HTMLElement` directly) — used where Lit is intentionally excluded. Example: `magnetic`.

Every component exposes a `replay()` method for the preview UI's replay button.

### Registry → consumer flow

Any component folder that defines `component.json` can be referenced from the include-based source registries. `public/r/*.json` item payloads are the static files that `motion-kit add` fetches.

### Motion Kit CLI

Package: `packages/motion-kit-cli/`. Commands:

- `motion-kit init` — detect framework/package manager and write `motion-kit.json`
- `motion-kit add <name>` — install registry items (resolves `registryDependencies`, copies files/assets, installs npm deps)
- `motion-kit list` / `motion-kit list --all` — browse the registry catalog (hidden libs require `--all`)
- `motion-kit info` — show detected project info and config
- `motion-kit build` / `motion-kit build --check` — regenerate or validate `public/r` from source manifests

Consumer test apps live under `templates/`. See `packages/motion-kit-cli/RELEASE.md` for the release checklist.

### Preview site (`src/pages/index.astro`)

Imports all component `.ts` files in a `<script>` block to register the custom elements. Uses `ComponentCard` (`src/components/ui/component-card.astro`) as the gallery wrapper — it renders a preview slot, a replay button that calls `element.replay()`, and a copy-install button.

### Shared utilities

- `src/lib/utils/cn.ts` — `cn()` via `clsx` + `tailwind-merge`
- `src/lib/helpers/gsap.ts` — shared GSAP plugin registration
- `src/lib/helpers/color.ts`, `fluid-pointer.ts`, `svg-sdf.ts` — pure TS utilities ported from `ref/motion-core`

### Styling

Tailwind v4 via `@tailwindcss/vite`. Configured in `src/styles/global.css` with `@theme` tokens (custom font "Open Runde", `corner-shape: squircle`). Path alias `@` resolves to `src/`.

### Reference codebase

`ref/motion-core/` is a read-only Svelte 5 library (~48 animated components) included as migration reference. It is **not installed or built** as part of this project. See `thoughts/research/2026-05-31-motion-core-astro-migration.md` for the migration trade-off analysis (Svelte islands vs Lit vs vanilla `.astro`).

## Adding a new component

1. Create `src/registry/<group>/<name>/<name>-element.ts` (Lit or vanilla Custom Element)
2. Add `src/registry/<group>/<name>/component.json` with the registry item metadata
3. Add the item to the appropriate `src/registry/<group>/registry.json` include file
4. Update the corresponding `public/r/<name>.json` file (same schema as an individual registry item)
5. Import and demo the element in `src/pages/index.astro` inside a `<ComponentCard>`
6. All components must implement `replay()` for the preview UI
