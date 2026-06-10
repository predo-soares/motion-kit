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

Create `motion-blocks.json` for the current project.

Options:

- `--overwrite` replaces an existing config file
- `--cwd <path>` runs against another directory
- `--dry-run` prints what would happen without writing files
- `--verbose` prints diagnostic output

```bash
motion-blocks add magnetic
motion-blocks add magnetic card-stack
```

Install one or more registry items.

Options:

- `--no-install` skips package-manager dependency installation
- `--overwrite` replaces existing installed files
- `--yes` auto-confirms dependency installation without prompting
- `--diff [path]` prints unified diffs for files that would change, then exits without writing; accepts an optional path parameter
- `--view [path]` prints incoming file content (or asset metadata), then exits without writing; accepts an optional path parameter
- `--cwd <path>` runs against another directory
- `--dry-run` prints what would happen without writing files
- `--verbose` prints diagnostic output

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
- Package source: https://github.com/predo-soares/motion-kit/tree/main/packages/motion-blocks-cli
