# Motion Kit CLI — release checklist

Run this checklist before publishing `motion-kit-cli` to npm. It mirrors
[Milestone 10](../../thoughts/plans/2026-06-07-motion-kit-cli-milestones/10-fixture-matrix-and-release-readiness.md).

## Prerequisites

```bash
pnpm --filter motion-kit-cli build
pnpm registry:build:check
```

## CLI smoke tests

```bash
node packages/motion-kit-cli/dist/index.js --version
node packages/motion-kit-cli/dist/index.js --help
node packages/motion-kit-cli/dist/index.js info --cwd templates/astro
node packages/motion-kit-cli/dist/index.js list --cwd templates/astro
node packages/motion-kit-cli/dist/index.js list --all --cwd templates/astro
node packages/motion-kit-cli/dist/index.js add magnetic --dry-run --cwd templates/astro
```

## Unit tests

```bash
pnpm --filter motion-kit-cli test
```

## Template matrix (dry-run + production build)

From the monorepo root:

```bash
alias motion-kit='node packages/motion-kit-cli/dist/index.js'

for t in astro vite-react vue sveltekit nextjs; do
  motion-kit init --dry-run --cwd "templates/$t"
  motion-kit add magnetic --dry-run --cwd "templates/$t" || exit 1
done

for t in astro vite-react vue sveltekit nextjs; do
  (cd "templates/$t" && pnpm build) || exit 1
done
```

## Docs site

```bash
pnpm build
```

## Manual spot checks

- Follow README quick start in one template app.
- Confirm component docs show `motion-kit add <name>`, not `shadcn add`.
- Trigger a missing-config error (`motion-kit add magnetic` outside a project) and confirm the hint mentions `motion-kit init`.
- Trigger an invalid item error and confirm the hint mentions `motion-kit list`.

## Publishing

Only publish after every step above passes. Do not publish while the template
matrix or `registry:build:check` is failing — that locks in a broken CLI contract.
