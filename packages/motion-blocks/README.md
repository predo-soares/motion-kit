# Motion Blocks CLI

Install animated Web Components from the Motion Blocks registry into Astro, React, Next.js, SvelteKit, Vue, or plain Vite projects.

The npm package is `motion-blocks` and it exposes the `motion-blocks` command.

## Requirements

- Node.js `>=22.12.0`
- A project using `pnpm`, `npm`, `yarn`, or `bun`

## Quick start

Run the CLI from your project root:

```bash
# pnpm
pnpm dlx motion-blocks init
pnpm dlx motion-blocks add magnetic

# npm
npx motion-blocks init
npx motion-blocks add magnetic

# yarn
yarn dlx motion-blocks init
yarn dlx motion-blocks add magnetic

# bun
bunx --bun motion-blocks init
bunx --bun motion-blocks add magnetic
```

`motion-blocks init` detects your framework and package manager, writes `motion-blocks.json`, and applies small project patches when needed.

`motion-blocks add <name>` downloads the component source files, resolves registry dependencies, installs required npm packages, and prints a usage snippet for your framework.

## Commands

```bash
motion-blocks init
```

Create `motion-blocks.json` for the current project. When a config file already exists, the CLI prompts for confirmation unless you supply the `--overwrite` flag to force replacement. The `--dry-run` flag shows the overwrite action without writing, and `--verbose` prints diagnostic information.

Options:

- `--overwrite` replaces an existing config file without prompting
- `--cwd <path>` runs against another directory
- `--dry-run` prints what would happen without writing files
- `--verbose` prints diagnostic output

```bash
motion-blocks add magnetic
motion-blocks add magnetic card-stack
```

Install one or more registry items. After running, the CLI prints a summary showing counts grouped by outcome (created, updated, skipped, identical) so you know what to expect when installation completes.

Options:

- `--no-install` skips package-manager dependency installation
- `--overwrite` replaces existing installed files
- `--yes` auto-confirms dependency installation without prompting
- `--diff [path]` prints unified diffs for files that would change, then exits without writing; accepts an optional path parameter
- `--view [path]` prints incoming file content (or asset metadata), then exits without writing; accepts an optional path parameter
- `--cwd <path>` runs against another directory
- `--dry-run` prints what would happen without writing files
- `--verbose` prints diagnostic output

The `add` command detects non-interactive environments (CI or piped stdin) and will automatically skip writing conflicting files unless `--overwrite` is provided. For CI/CD workflows, include `--overwrite` to force file replacement.

```bash
motion-blocks list
motion-blocks list interaction
motion-blocks list --all
motion-blocks list --type registry:component
```

List items from the configured registry catalog.

```bash
motion-blocks info
```

Show detected project information and the active Motion Blocks configuration.

```bash
motion-blocks build
motion-blocks build --check
```

Maintainer command for registry authors. It validates source manifests and regenerates static registry payloads in `public/r`. Use `--check` to validate without writing files.

## Maintainer publishing path

Published items start in the source registry, not in the generated `public/r` files.

1. Create the Web Component in `src/registry/<group>/<name>/`. Components are custom elements, usually Lit-based, and visible preview items must expose `replay()` for the demo replay control.
2. Add `src/registry/<group>/<name>/component.json`. This is the opt-in component manifest and the source of truth for the published item.
3. Include the item name in the composed source registry: `src/registry/<group>/registry.json`, reached from the root `registry.json` include list.
4. Add a demo partial at `src/components/demos/<name>-demo.astro` for visible components.
5. Run `motion-blocks build --check`, then `motion-blocks build` when you are ready to regenerate `public/r/<name>.json` and `public/r/registry.json`.

Author explicitly in `component.json`: `name`, `type`, `title`, `description`, npm `dependencies` or `devDependencies`, `registryDependencies`, `files` with install `target` paths, `usage`, `props`, and any intentional docs metadata under `meta.docs`.

Derived during build: text file `content`, asset `url` entries, `$schema`, the flattened catalog entry in `public/r/registry.json`, docs catalog data, group assignment from the composed source registry, default docs order from include order, and default preview registrations from `registry:component` files ending in `-element.ts`.

Use `meta.docs.order` only when include order is not enough. Use `meta.docs.previewRegistrations` only when a visible item needs supporting custom elements or a registration list that cannot be derived from its `-element.ts` files. Do not add a second docs catalog record or separate preview wiring for the same item.

Hidden helper libraries use `type: "registry:lib"` with `meta.hidden: true`. They stay out of normal docs browsing and `motion-blocks list`, appear with `motion-blocks list --all` or `--type registry:lib`, and remain installable when referenced through `registryDependencies`. Hidden metadata is only supported for `registry:lib` items.

When consumers run `motion-blocks add <name>`, the CLI fetches the static payload from the configured registry, resolves `registryDependencies`, writes every file to its declared `target`, installs npm dependencies unless disabled, and prints framework usage guidance.

## Configuration

The CLI reads `motion-blocks.json` from your project root.

```json
{
  "$schema": "https://motionkit.org/schemas/motion-blocks.json",
  "registry": "https://motionkit.org/r",
  "framework": "astro",
  "packageManager": "pnpm",
  "componentsDir": "src/components/motion-blocks",
  "helpersDir": "src/lib/motion-blocks"
}
```

Fields:

- `registry`: base URL for registry payloads
- `framework`: `astro`, `next`, `react`, `vue`, `nuxt`, `svelte`, `sveltekit`, or `plain`
- `packageManager`: `pnpm`, `npm`, `yarn`, or `bun`
- `componentsDir`: where component source files are written
- `helpersDir`: where shared helper files are written

## Using installed components

Installed items are Web Components. Import the generated element module once in client-side code, then use the custom element in your markup.

```ts
import "./components/motion-blocks/magnetic-element";
```

```html
<motion-magnetic>
  <button type="button">Hover me</button>
</motion-magnetic>
```

React and TypeScript projects may need custom element typings if JSX reports an unknown intrinsic element.

## Common workflows

Preview what a command will change:

```bash
motion-blocks add magnetic --dry-run
```

Install without automatically installing npm dependencies:

```bash
motion-blocks add magnetic --no-install
```

Run against another project directory:

```bash
motion-blocks info --cwd ./templates/astro
motion-blocks add magnetic --cwd ./templates/astro
```

Inspect the public registry before installing:

```bash
motion-blocks list
motion-blocks list --all
```

## Links

- Docs: https://motionkit.org/docs
- Registry: https://motionkit.org/r/registry.json
- Package source: https://github.com/predo-soares/motion-kit/tree/main/packages/motion-blocks
