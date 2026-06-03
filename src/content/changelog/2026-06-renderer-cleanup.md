---
title: Renderer cleanup across OGL-backed components
description: Several canvas-driven demos received stricter cleanup so replay and disconnect flows do not leave work behind.
date: 2026-06-02
---

Multiple OGL-based components were updated to release work more cleanly after replay, remount, or disconnect.

## What changed

- Cleaned up replay-time resources in glitter-cloth and pixelated-image.
- Added disconnect-time cancellation guards to halo and god-rays.
- Reduced the chance of lingering RAF loops after a component leaves the page.
- Tightened runtime behavior for repeated preview interactions in the docs browser.

## Why it matters

These changes make the demos more resilient during repeated testing and help exported components behave more responsibly in consumer apps.
