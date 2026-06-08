# motion-kit SvelteKit example

A minimal SvelteKit project used to test installing components from the Motion Kit
registry via the `motion-kit` CLI.

## Setup

This template ships a committed `motion-kit.json`. To recreate it in a fresh
project:

```sh
pnpm dlx motion-kit init
```

When testing from the monorepo root:

```sh
pnpm --filter motion-kit-cli build
node packages/motion-kit-cli/dist/index.js init --cwd templates/sveltekit
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
pnpm dlx motion-kit add magnetic
```

From the monorepo:

```sh
node packages/motion-kit-cli/dist/index.js add magnetic --cwd templates/sveltekit
```

Import the element once in `+layout.svelte` (or per-page) so it registers before
use:

```svelte
<script lang="ts">
  import "$lib/components/motion-kit/magnetic-element";
</script>
```

## Using the component

```svelte
<script lang="ts">
  import "$lib/components/motion-kit/magnetic-element";
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
