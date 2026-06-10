# Motion Blocks CLI — release checklist

Run this checklist before publishing `motion-blocks` to npm.

## Prerequisites

```bash
pnpm --filter motion-blocks build
pnpm registry:build:check
```

## CLI smoke tests

```bash
node packages/motion-blocks/dist/index.js --version
node packages/motion-blocks/dist/index.js --help
node packages/motion-blocks/dist/index.js info --cwd templates/astro
node packages/motion-blocks/dist/index.js list --cwd templates/astro
node packages/motion-blocks/dist/index.js list --all --cwd templates/astro
node packages/motion-blocks/dist/index.js add magnetic --dry-run --cwd templates/astro
```

## Unit tests

```bash
pnpm --filter motion-blocks test
```

## Template matrix (dry-run + production build)

From the monorepo root:

```bash
alias motion-blocks='node packages/motion-blocks/dist/index.js'

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

`pnpm registry:build:check` must pass before the docs build. It validates that
visible published components have `component.json`, composed source registry
inclusion, demo partials, valid docs order, and preview registration metadata.
It also preserves hidden registry lib behavior for catalog browsing and registry
dependencies.

## Manual spot checks

- Follow README quick start in one template app.
- Confirm component docs show `motion-blocks add <name>`, not `shadcn add`.
- Confirm visible component docs came from the published item metadata, without separate docs catalog records or item-level preview wiring.
- Trigger a missing-config error (`motion-blocks add magnetic` outside a project) and confirm the hint mentions `motion-blocks init`.
- Trigger an invalid item error and confirm the hint mentions `motion-blocks list`.

## Publishing

Only publish after every step above passes. Do not publish while the template
matrix or `registry:build:check` is failing — that locks in a broken CLI contract.

### 1. Bump the version

Edit `packages/motion-blocks/package.json` and increment the `version` field following semver:

- **patch** (`0.0.x`) — bug fixes, no new features
- **minor** (`0.x.0`) — new features, backwards-compatible
- **major** (`x.0.0`) — breaking changes

Or use the npm version helper (run from `packages/motion-blocks`):

```bash
cd packages/motion-blocks
npm version patch   # or minor / major
```

### 2. Build for release

From the monorepo root:

```bash
pnpm --filter motion-blocks build
```

### 3. Dry-run publish (check what will be included)

```bash
cd packages/motion-blocks
npm publish --dry-run
```

Verify that only `dist/` and `README.md` appear in the file list (matches the `files` field in `package.json`).

### 4. Publish to npm

```bash
cd packages/motion-blocks
npm publish --access public
```

> You must be logged in (`npm whoami`) and have publish rights to the `motion-blocks` package on npm.
> Log in with `npm login` if needed.

### 5. Verify the published package

```bash
npm info motion-blocks
npx motion-blocks --version
```

### 6. Tag the release in git

From the monorepo root:

```bash
git add packages/motion-blocks/package.json
git commit -m "chore(motion-blocks): release vX.Y.Z"
git tag motion-blocks-vX.Y.Z
git push origin main --tags
```
