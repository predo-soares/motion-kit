# Motion Blocks SvelteKit example

A minimal SvelteKit project used to test installing components from the Motion Blocks
registry via the `motion-blocks` CLI.

## Setup

This template ships a committed `motion-blocks.json`. To recreate it in a fresh
project:

```sh
pnpm dlx motion-blocks init
```

When testing from the monorepo root:

```sh
pnpm --filter motion-blocks build
node packages/motion-blocks-cli/dist/index.js init --cwd templates/sveltekit
```

Point `registry` at your local docs server when testing against
`http://localhost:4321/r`:

```json
{
  "registry": "http://localhost:4321/r"
}
```

## Install a component

```sh
pnpm dlx motion-blocks add magnetic
```

From the monorepo:

```sh
node packages/motion-blocks-cli/dist/index.js add magnetic --cwd templates/sveltekit
```

Import the element once in `+layout.svelte` (or per-page) so it registers before
use:

```svelte
<script lang="ts">
  import "$lib/components/motion-blocks/magnetic-element";
</script>
```

## Using the component

```svelte
<script lang="ts">
  import "$lib/components/motion-blocks/magnetic-element";
</script>

<motion-magnetic duration={1.2}>
  <button>Hover me</button>
</motion-magnetic>
```

## Commands

| Command        | Action                                      |
| :------------- | :------------------------------------------ |
| `pnpm install` | Installs dependencies                        |
| `pnpm dev`     | Starts local dev server at `localhost:5173` |
| `pnpm build`   | Production build                             |
| `pnpm preview` | Preview the production build                 |
