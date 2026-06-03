---
title: Stability sweep across demos and interactions
description: A focused pass on runtime safety and keyboard behavior across the newest interactive components.
date: 2026-06-02
---

Recent work focused on runtime cleanup and interaction safety across the latest demos.

## What changed

- Fixed a globe build regression caused by a duplicate uniforms declaration.
- Prevented orphaned animation loops in halo and god-rays after disconnect.
- Scoped keyboard and fullscreen shortcuts more carefully so typing and Escape handling stay predictable.
- Moved image-trail styling into shadow DOM-safe styles instead of relying on Tailwind classes.

## Why it matters

These fixes reduce the kind of regressions that only show up after repeated remounts, keyboard use, or extended demo interaction. The result is a more reliable component browser and cleaner exported behavior for consumers.
