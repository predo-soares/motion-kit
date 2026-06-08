# Motion Blocks Vite React example

A minimal React + Vite project used to test installing components from the Motion Blocks
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
node packages/motion-blocks-cli/dist/index.js init --cwd templates/vite-react
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
node packages/motion-blocks-cli/dist/index.js add magnetic --cwd templates/vite-react
```

Use `--overwrite` to replace existing installed files:

```sh
node packages/motion-blocks-cli/dist/index.js add magnetic --overwrite --cwd templates/vite-react
```

## Using the component

Import the element module in any client-side React file:

```tsx
import "@/components/motion-blocks/magnetic-element";

export default function App() {
  return (
    <motion-magnetic duration={1.2}>
      <button type="button">Hover me</button>
    </motion-magnetic>
  );
}
```

Add JSX types for the custom element in `src/custom-elements.d.ts` if TypeScript
complains about `motion-magnetic`.

If Vite struggles to pre-bundle Lit/GSAP, add to `vite.config.ts`:

```ts
optimizeDeps: {
  include: ['lit', 'gsap'],
},
```

## Commands

| Command        | Action                                      |
| :------------- | :------------------------------------------ |
| `pnpm install` | Installs dependencies                        |
| `pnpm dev`     | Starts local dev server at `localhost:5173` |
| `pnpm build`   | Type-check and production build              |
| `pnpm preview` | Preview the production build                 |
