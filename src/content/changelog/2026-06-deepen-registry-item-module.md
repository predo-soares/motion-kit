---
title: Deeper published registry item module
description: Docs catalog, preview registration, and nav ordering now derive from published registry item metadata — manual seed lists and hand-edited import lists are gone.
date: 2026-06-10
---

This release removes a class of maintenance work that grew with every new registry item. Adding a component previously required updating the docs catalog seed, the preview element import list, and the navigation ordering by hand. Those three surfaces now derive from a single published item interface.

## What changed

- **Docs catalog from registry metadata** — the component index, sidebar, and detail pages all pull from the published registry item list instead of a separate hand-maintained seed. Grouping, ordering, and hidden-lib filtering come from registry source data.
- **Preview registration from `elements` metadata** — `component-preview-scripts.astro` no longer contains a long hand-edited import list. Custom element modules are registered based on each published item's `elements` field, including supporting elements for multi-element items.
- **Prev/next navigation aligned with catalog order** — previous and next links on detail pages use the same ordered published item list as the catalog, so navigation and browsing order cannot drift apart.
- **Build-time drift validation** — `registry:build:check` now catches: missing `component.json`, item included in source registry without a manifest, published item without a demo partial, missing preview registration metadata, invalid docs ordering values, and orphaned catalog entries. Each failure names the item and the missing piece.
- **Package path consolidation** — the CLI package moved from `motion-blocks-cli` to `motion-blocks` across root scripts, `README.md`, `RELEASE.md`, and build paths.

## Why it matters

Publishing a new registry item now means: write the Web Component, write `component.json`, include it in the composed source registry, add a demo. Everything else — catalog placement, preview wiring, navigation — follows automatically. Missing any piece produces a named build failure rather than a silent gap in the docs.
