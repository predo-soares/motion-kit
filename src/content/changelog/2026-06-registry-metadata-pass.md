---
title: Registry metadata and animation behavior pass
description: Smaller registry fixes landed alongside behavior corrections for galleries and layout-driven components.
date: 2026-06-02
---

Not every meaningful release note is a headline feature. This pass collected a set of smaller fixes that improve installation metadata and runtime behavior.

## What changed

- Corrected the `images` prop metadata for infinite-gallery docs.
- Limited flip-grid animations to actual layout-attribute changes.
- Scoped gallery navigation behavior more tightly to the component instance.
- Regenerated registry output after metadata corrections.

## Why it matters

The registry becomes more trustworthy when docs metadata and runtime behavior stay aligned. These smaller fixes reduce friction for both browsing and installing components.
