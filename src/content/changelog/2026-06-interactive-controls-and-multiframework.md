---
title: Interactive controls, velocity-card, and multi-framework support
description: Live attribute controls land on 14 demos, velocity-card joins the interaction catalog, and the preview site can now host React, Svelte, and Vue components.
date: 2026-06-03
---

The biggest quality-of-life improvement for the component browser arrived today: every major demo now has a live controls panel where you can adjust attributes in real time without touching code. Alongside that, the registry and docs received a round of structural work that sets a cleaner foundation for what comes next.

## What changed

- Added velocity-card, a new interaction component that tilts and scales on pointer hover using velocity to drive transform intensity.
- Wired interactive attribute controls (sliders, toggles, selects, text inputs) to 14 component demos: card-stack, flip-card-stack, infinite-gallery, infinite-physics-gallery, magnetic, marquee, split-hover, split-reveal, stacking-words, text-loop, text-repel, text-scramble, video-player, and weight-wave.
- Added React, Svelte, and Vue integrations to the preview site and a new framework matrix test runner accessible at `/docs/components/:slug/test`.
- Introduced mk-text-input as a new control primitive, and extended mk-select to accept a JSON options attribute when no child elements are present.
- Moved all docs pages under the `/docs/` prefix and added an Introduction page; the old `/components/` and `/changelog/` routes are gone.
- Migrated the root registry.json from a monolithic inline list to include-based per-group manifests under `src/registry/<group>/registry.json`.
- Fixed magnetic-element quickTo lifecycle so functions reinitialise on prop changes and clean up correctly on disconnect.
- Fixed a fullscreen preview bug where the card was reinserted before the placeholder was removed.

## Why it matters

The interactive controls panel closes the loop between reading a component's props and actually seeing them change. Being able to scrub a slider and watch the animation respond makes the catalog genuinely useful as a design tool, not just a showcase. The multi-framework test harness means component behavior can be verified in React, Svelte, and Vue without leaving the site.
