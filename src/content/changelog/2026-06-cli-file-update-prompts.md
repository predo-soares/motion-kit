---
title: CLI file-update prompts and preview flags
description: The motion-blocks CLI now asks before overwriting existing files, supports read-only diff and view previews, and never hangs in CI.
date: 2026-06-10
---

This release focused on making the CLI safe to run inside existing projects. Rather than silently clobbering files, it pauses and asks — or skips automatically in non-interactive environments.

## What changed

- **Per-file write decisions** — before any existing file is changed, the CLI shows a diff and asks whether to overwrite, skip, or keep. New files are always created without a prompt.
- **`motion-blocks init` confirmation** — re-running init on a project that already has `motion-blocks.json` asks before overwriting; declining skips the config write but lets the rest of init continue.
- **Patch prompts** — tsconfig and vite.config patches now show the planned change and ask for confirmation before applying. Declining prints the equivalent manual step.
- **`--yes` flag** — auto-confirms the dependency install prompt without affecting per-file overwrite safety.
- **`--diff [path]` and `--view [path]`** — read-only preview flags for `motion-blocks add`; nothing is written, no prompts are shown.
- **CI safety** — non-interactive environments (piped stdin, no TTY) default to skipping conflicting files instead of hanging. Pass `--overwrite` to override.
- **Outcome summary** — after `motion-blocks add` finishes, a count shows how many files were created, updated, skipped, or identical.
- **React support** — `init` vite patcher now handles React projects; `add` patches JSX custom-element types on React targets.
- **CLI 0.0.2** — package version bumped with full npm metadata (homepage, repository, bugs, keywords).

## Why it matters

Running the CLI a second time used to risk losing local edits. The per-file prompt model removes that risk: you stay in control of every change, and the outcome summary tells you exactly what happened. CI pipelines get the same safety without needing extra flags.
