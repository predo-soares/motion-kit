# motion-kit Vue example

A minimal Vue + Vite project used to test installing components from the Motion Kit
registry via the `motion-kit` CLI.

## Setup

This template ships a committed `motion-kit.json`. To recreate it in a fresh
project:

```sh
pnpm dlx motion-kit init
```

`init` for Vue also patches `vite.config.ts` with `optimizeDeps.include: ['lit', 'gsap']`
and enables `experimentalDecorators` in `tsconfig.app.json`.

When testing from the monorepo root:

```sh
pnpm --filter motion-kit-cli build
node packages/motion-kit-cli/dist/index.js init --cwd templates/vue
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
node packages/motion-kit-cli/dist/index.js add magnetic --cwd templates/vue
```

Dry-run:

```sh
node packages/motion-kit-cli/dist/index.js add magnetic --dry-run --cwd templates/vue
```

## Using the component

Import the element in `<script setup>` so the custom element registers in the
browser:

```vue
<script setup>
import "@/components/motion-kit/magnetic-element.ts";
</script>

<template>
  <motion-magnetic duration="1.2">
    <button>Hover me</button>
  </motion-magnetic>
</template>
```

## Commands

| Command        | Action                                      |
| :------------- | :------------------------------------------ |
| `pnpm install` | Installs dependencies                        |
| `pnpm dev`     | Starts local dev server at `localhost:5173` |
| `pnpm build`   | Type-check and production build              |
| `pnpm preview` | Preview the production build                 |
