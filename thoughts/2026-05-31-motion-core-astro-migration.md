# Research: porting motion-core to Astro — and whether Lit belongs in the middle

**Date**: 2026-05-31  
**Branch**: main  
**Repository**: motion-kit-astro  
**Topic**: Migration challenges from `ref/motion-core/packages` to Astro components; Lit trade-off analysis

---

## Research question

From `ref/motion-core/packages` — what are the migration challenges to turn these Svelte 5 components into Astro components, and should Lit be used as a web components library inside Astro? Consider trade-offs.

---

## What's in `ref/motion-core/packages`

One package — `motion-core` (v0.15.1) — a Svelte 5 library declared `private`, exported as `svelte: "./src/lib/index.ts"`. Nx workspace project; lint/check via `bunx`.

**Component inventory.** ~48 components in `src/lib/components/<slug>/`. Each dir follows a predictable shape:

- `<Name>.svelte` — public entry: typed `Props`, `cn()` class merging, optional `<Scene>` embed.
- `<Name>Scene.svelte` (when WebGL) — `onMount` creates an `ogl` renderer, runs a RAF loop, returns cleanup. ~20 of the 48 components follow this wrapper+scene split.
- `component.json` — registry metadata (slug, category, deps, files list with `kind: "entry"` / `target` mapping). Drives shadcn-style distribution.
- Sometimes auxiliary parts (`GlobeMarkerItem.svelte`, `Card3DFaceTracker.svelte`, `LogoColumn.svelte`, `types.ts`).

**Shared module surface** (`src/lib/`):
- `utils/cn.ts` — `clsx` + `tailwind-merge`.
- `utils/use-portal.ts` — Svelte action that moves a node to a CSS selector or HTMLElement target.
- `helpers/gsap.ts` — plugin-once registry + custom ease (`"motion-core-ease": "0.625, 0.05, 0, 1"`).
- `helpers/color.ts`, `helpers/fluid-pointer.ts`, `helpers/svg-sdf.ts` — pure-TS utilities (color conversion, pointer state lerp, SDF rasterizer for `glass-logo`).
- `tokens/motion-core.css` — Tailwind v4 token sheet using `oklch` palettes + `@variant dark (&:where(.dark, .dark *))`.
- `assets/*.png` — `land-texture.png`, `water-ripple-brush.png`.

**Peer deps gating migration**: `svelte@^5`, `gsap@^3.14`, `tailwindcss@^4.1`, `ogl@^1.0.11` (lightweight WebGL, not Three.js), `@mediapipe/tasks-vision` (face tracking, WASM). Internal: `clsx`, `tailwind-merge`.

**Svelte 5 idioms in heavy use** — every one is a porting question:
- Runes: `$props()`, `$state()`, `$derived.by()`, `$effect()`, `untrack()`.
- `Snippet` / `Snippet<[Ctx]>` — typed callable children. `Globe.svelte` passes `markerTooltip: Snippet<[GlobeMarkerTooltipContext]>` invoked per marker with `{ marker, index, visibility }`.
- `{@attach …}` directive — Svelte 5 ref pattern returning a cleanup function.
- `{@render snippet?.()}` — replaces named slots.
- `use:portal={target}` — for FloatingMenu's body-level overlay.
- `gsap.context(() => …, scopeEl)` + `ctx.revert()` for per-instance animation cleanup.

**Registry shape.** `scripts/build-registry.ts` reads each `component.json`, copies files into an output registry, generates a docs manifest. `motion-kit-astro` already replicates the same shadcn-compatible namespace pattern with `.astro` items.

---

## Migration challenges to Astro components

The fundamental mismatch: **Astro components are server-rendered, single-shot HTML templates**. No runtime reactivity, no lifecycle, no per-instance state. Motion-core is overwhelmingly client-side: ~90% of the 48 components animate, run WebGL, listen to pointer/scroll, or hold mutating state.

"Turn these into Astro components" splits into two very different problems:

### 1. Pure-template components (small subset)

`CardStackItem.svelte` is a styled div with children — zero JS. **Correction from initial research:** it is not a standalone registry item. It is a sub-file of `card-stack` and ships alongside `CardStack.svelte`, which holds the GSAP ScrollTrigger scroll-pinning logic. Porting either means porting both as a single multi-file registry entry (`card-stack.astro` + `card-stack-item.astro`). The "pure template" category is therefore very small in practice.

### 2. Reactive / animated / WebGL components (almost everything else)

These cannot live entirely in `.astro`. Three realistic targets:

**(a) Astro `.astro` shell + vanilla `<script>`.** Hand-translate Svelte's `$state` / `$effect` / `{@attach}` into element queries inside a module script. Works, but: you re-invent per-instance scoping for GSAP contexts; you lose typed `Snippet<[Ctx]>` entirely, because Astro slots are HTML strings, not callables.

**(b) Astro island around a kept Svelte component.** Add `@astrojs/svelte`, render `<MagneticSvelte client:visible {...props}>` inside an `.astro` wrapper. Source of truth stays Svelte; registry items become `.astro` wrapper + Svelte source files + helpers + tokens. Lowest migration cost. Consumer adds Svelte runtime.

**(c) Astro island around a Lit Custom Element.** Same wrapper idea but the inner component is `LitElement`. Trade-offs analyzed below.

### Concrete pain points regardless of target

| Challenge | Detail |
|---|---|
| `Snippet<[Ctx]>` | Globe's per-marker `markerTooltip({ marker, index, visibility })` requires invoking user-provided template with per-iteration data. Astro slots can't do this. Lit needs a function-prop; Svelte islands keep this for free. |
| GSAP context scoping | `gsap.context(() => …, currentElement)` ties timelines to one instance for clean `revert()`. In `.astro` + vanilla, requires `data-instance-id` pattern. In Lit, `disconnectedCallback` is the natural home. |
| `use:portal` | No native Astro equivalent. Must be reimplemented at mount time in any island runtime. |
| SSR-hostile deps | MediaPipe/ogl/GSAP plugins fail in SSR. Require `client:only` islands or dynamic `import()` in scripts. |
| Tailwind tokens | Travel cleanly. Astro 6 + `@tailwindcss/vite` (already present) consumes `tokens/motion-core.css` with no changes. |
| `classes?: { slot: ClassValue }` overrides | FloatingMenu defines 16 per-slot class keys. Pattern depends on consumer Tailwind utilities reaching internal `data-slot` elements — breaks with shadow DOM (see Lit section). |

**Code reference hotspots:**
- `packages/motion-core/src/lib/components/index.ts:1-49` — full 48-component export surface
- `packages/motion-core/src/lib/components/magnetic/Magnetic.svelte:27-79` — canonical `$props` + `gsap.context` + `{@attach}` pattern
- `packages/motion-core/src/lib/components/neural-noise/NeuralNoiseScene.svelte:90-153` — ogl WebGL Scene with RAF + DPR resize + cleanup
- `packages/motion-core/src/lib/components/globe/Globe.svelte:76-103` — `Snippet<[GlobeMarkerTooltipContext]>` callable slot
- `packages/motion-core/src/lib/components/floating-menu/FloatingMenu.svelte:53-72,261-289` — per-slot `classes?` + `use:portal`
- `packages/motion-core/src/lib/components/card-3d/Card3DFaceTracker.svelte:49-86` — MediaPipe + WebRTC + WASM load (SSR-hostile)
- `packages/motion-core/src/lib/tokens/motion-core.css:1-90` — Tailwind v4 theme tokens

---

## Should you use Lit?

Lit is a first-class Astro citizen (`@astrojs/lit`). The integration is real. But it's not the natural choice for *this* library given how it's designed.

### Arguments FOR Lit

- Real Custom Elements: a `<motion-globe>` tag is framework-agnostic. Consumers using React, Vue, Astro, or plain HTML can drop it in — matches a "registry of components" mental model better than Svelte (Svelte needs a Svelte runtime).
- ~5kb shared runtime vs 48 compiled Svelte component units.
- `LitElement` lifecycle (`connectedCallback`, `disconnectedCallback`, `firstUpdated`) maps cleanly to `onMount`/`onDestroy` + `$effect`.
- Shadow DOM gives style isolation — distribution is safer (consumer's Tailwind reset can't break your component).

### Arguments AGAINST Lit (why it's a harder sell for this library)

**Shadow DOM breaks motion-core's styling contract.** The current API expects consumers to pass `class` and `classes?: { slot: ClassValue }` so their Tailwind utilities apply to internal `data-slot` elements. Shadow DOM blocks parent styles from reaching shadow children. Options:
- Abandon shadow DOM (`createRenderRoot() { return this }`) — keeps API, loses Lit's isolation benefit.
- Keep shadow DOM and redesign every component's styling contract around `::part()` + CSS custom properties — a large rewrite that also regresses consumer ergonomics ("style with Tailwind" → "set these CSS vars").

**`Snippet<[Ctx]>` regresses.** Lit's slot composition is markup-only. Passing per-iteration context requires a `renderItem: (ctx) => TemplateResult` property — a different API for consumers.

**GSAP/ogl logic is identical work either way.** Lit doesn't reduce rewrite cost for heavy components — it just changes lifecycle hook names.

**TypeScript ergonomics are clunkier.** Lit `@property` decorators work, but reflecting union types, JSON-shaped props, and attribute converters are more verbose than Svelte 5's `Props` interface.

**You'd be rewriting 48 working components.** Multi-week project for a benefit (framework-agnostic Custom Elements) that only matters if you expect non-Svelte/non-Astro consumers.

### Decision framework

| Scenario | Recommendation |
|---|---|
| Registry primarily consumed in Astro+Svelte projects | Keep Svelte, wrap with `.astro` shells + `@astrojs/svelte` islands |
| Need components to work in React/Vue/vanilla HTML too | Lit is worth the redesign effort — but rework `classes?` → `::part()` + CSS vars |
| Some components shipped anywhere, most Astro-only | Mixed: Lit for a few hero components, Svelte islands for the rest |
| Purely static/layout components | Pure `.astro` — no runtime needed |

---

## Recommendation

**Cheapest path that preserves the API:** add `@astrojs/svelte` to `motion-kit-astro` and distribute each motion-core component as a thin `.astro` wrapper that mounts the kept Svelte source as an island (`client:visible` / `client:idle` per component). Port static-only components (`CardStackItem`, simple shells) to pure `.astro` for free. Reach for Lit only if framework-agnostic Custom Elements are a hard requirement — and accept that the styling contract (Tailwind utility overrides per slot) needs to be redesigned around `::part()`/CSS vars if you keep shadow DOM.

---

## Open questions

1. Do you want framework-agnostic consumption (React/Vue/plain HTML consumers)? If yes → Lit becomes more attractive despite the styling redesign. If no → Svelte-islands path dominates.
2. Are you willing to drop `classes?: { slot: ClassValue }` overrides for `::part()` + CSS variables? That's the make-or-break trade for shadow DOM.
3. Should the registry distribute Svelte sources alongside `.astro` wrappers, or do you want single-file `.astro` per item (which forces vanilla-JS reimplementation for heavy components)?
