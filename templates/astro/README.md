# Motion Blocks Astro example

A minimal Astro project used to test installing components from the Motion Blocks
registry via the `motion-blocks` CLI.

## Setup

This fixture ships a committed `motion-blocks.json`. To recreate it in a fresh
project:

```sh
pnpm dlx motion-blocks init
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

For a local registry during development:

```sh
pnpm dlx motion-blocks add magnetic --dry-run
```

When testing from the monorepo root:

```sh
pnpm --filter motion-blocks build
node packages/motion-blocks-cli/dist/index.js add magnetic --cwd templates/astro
```

`components.json` is not used by Motion Blocks. If your project also uses shadcn/ui,
keep that file for the shadcn CLI only.

## Using the component

Components from this registry are framework-agnostic **Web Components**
(Custom Elements). They must be imported in a `<script>` tag — **not** in the
Astro frontmatter — so the `customElements.define()` call runs in the browser
rather than during server-side rendering:

```astro
---
import "@/styles/global.css";
---

<body class="flex min-h-screen items-center justify-center">
  <motion-magnetic strength="0.5">
    <button class="rounded-full bg-foreground px-8 py-4 text-background">
      Hover me
    </button>
  </motion-magnetic>

  <script>
    import "@/components/motion-blocks/magnetic-element.ts";
  </script>
</body>
```

## Commands

| Command        | Action                                       |
| :------------- | :------------------------------------------- |
| `pnpm install` | Installs dependencies                         |
| `pnpm dev`     | Starts local dev server at `localhost:4321`   |
| `pnpm build`   | Build your production site to `./dist/`       |
| `pnpm preview` | Preview your build locally, before deploying  |
