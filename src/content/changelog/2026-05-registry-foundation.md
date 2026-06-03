---
title: Astro-native registry foundation
description: The project took shape as a custom Astro registry with manifest-driven items and static JSON output.
date: 2026-05-31
---

The first milestone was defining the project as an Astro-native registry instead of a React wrapper around distribution files.

## What changed

- Established Astro-native registry items instead of React wrappers.
- Wired `@/` imports across the app and aligned the Astro and Vite alias configuration.
- Kept distributable registry payloads in `public/r` while source items live in `src/registry/new-york/blocks`.
- Built the initial catalog structure that now powers the component browser.

## Why it matters

This set the direction for the whole repo. Registry files stay static and easy to consume, while source code stays organized around Astro wrappers, custom elements, and per-block manifests.
