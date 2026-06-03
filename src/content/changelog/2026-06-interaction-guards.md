---
title: Interaction guards for docs and menus
description: Keyboard handling and interactive controls became safer across fullscreen previews, menus, and galleries.
date: 2026-06-02
---

This pass focused on reducing interaction bugs that only show up during real browsing sessions.

## What changed

- Ignored fullscreen shortcuts while users are typing in interactive fields.
- Scoped arrow-key handling to the active gallery instead of the whole page.
- Moved Escape handling for floating menus to the document level.
- Reduced accidental interaction conflicts between the docs shell and embedded demos.

## Why it matters

The docs shell now behaves more predictably when components need their own keyboard input. That keeps the page chrome from fighting the demo itself.
