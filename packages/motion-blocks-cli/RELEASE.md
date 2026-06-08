# Motion Blocks CLI — release checklist

Run this checklist before publishing `motion-blocks` to npm. It mirrors
[Milestone 10](../../thoughts/plans/2026-06-07-motion-blocks-cli-milestones/10-fixture-matrix-and-release-readiness.md).

## Prerequisites

```bash
pnpm --filter motion-blocks build
pnpm registry:build:check
```

## CLI smoke tests

```bash
node packages/motion-blocks-cli/dist/index.js --version
node packages/motion-blocks-cli/dist/index.js --help
node packages/motion-blocks-cli/dist/index.js info --cwd templates/astro
node packages/motion-blocks-cli/dist/index.js list --cwd templates/astro
node packages/motion-blocks-cli/dist/index.js list --all --cwd templates/astro
node packages/motion-blocks-cli/dist/index.js add magnetic --dry-run --cwd templates/astro
```

## Unit tests

```bash
pnpm --filter motion-blocks test
```

## Template matrix (dry-run + production build)

From the monorepo root:

```bash
alias motion-blocks='node packages/motion-blocks-cli/dist/index.js'

for t in astro vite-react vue sveltekit nextjs; do
  motion-blocks init --dry-run --cwd "templates/$t"
  motion-blocks add magnetic --dry-run --cwd "templates/$t" || exit 1
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
- Confirm component docs show `motion-blocks add <name>`, not `shadcn add`.
- Trigger a missing-config error (`motion-blocks add magnetic` outside a project) and confirm the hint mentions `motion-blocks init`.
- Trigger an invalid item error and confirm the hint mentions `motion-blocks list`.

## Publishing

Only publish after every step above passes. Do not publish while the template
matrix or `registry:build:check` is failing — that locks in a broken CLI contract.
