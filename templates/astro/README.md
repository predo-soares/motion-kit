# motion-kit Astro example

A minimal Astro project used to test installing components from the Motion Kit
registry via the `motion-kit` CLI.

## Setup

This fixture ships a committed `motion-kit.json`. To recreate it in a fresh
project:

```sh
pnpm dlx motion-kit init
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

For a local registry during development:

```sh
pnpm dlx motion-kit add magnetic --dry-run
```

When testing from the monorepo root:

```sh
pnpm --filter motion-kit-cli build
node packages/motion-kit-cli/dist/index.js add magnetic --cwd templates/astro
```

`components.json` is not used by Motion Kit. If your project also uses shadcn/ui,
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
    import "@/components/motion-kit/magnetic-element.ts";
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
