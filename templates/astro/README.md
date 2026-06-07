# motion-kit Astro example

A minimal Astro project used to test installing components from the local
`motion-kit-astro` registry (served at `http://localhost:4321/r/*.json`) via the
`shadcn` CLI.

## Steps taken to set this up

1. **Add the `@` path mapping** to `tsconfig.json` (matches the alias the
   registry components import with):

   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "experimentalDecorators": true,
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

2. **Install a component directly from the local registry JSON URL**:

   ```sh
   pnpm dlx shadcn@latest add http://localhost:4321/r/magnetic.json
   ```

   Since there's no `components.json` yet, the CLI prompts to bootstrap one
   inline — this single step installs Tailwind CSS v4, registers the
   `@tailwindcss/vite` plugin and `@` import alias in `astro.config.mjs`,
   creates `src/styles/global.css`, and generates `components.json`,
   `src/lib/utils.ts`, and a base `src/components/ui/button.tsx`. It then
   drops the Web Component source at
   `src/components/motion-kit/magnetic-element.ts` and installs its
   dependencies (`lit`, `gsap`).

   Don't forget to load the generated stylesheet from
   `src/pages/index.astro`'s frontmatter:

   ```astro
   ---
   import "@/styles/global.css";
   ---
   ```

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
