# motion-kit Next.js example

A minimal Next.js project used to test installing components from the local
`motion-kit-astro` registry (served at `http://localhost:4321/r/*.json`) via the
`shadcn` CLI.

## Steps taken to set this up

1. **Add the `@` path mapping** to `tsconfig.json` (matches the alias the
   registry components import with):

   ```json
   {
     "compilerOptions": {
       "experimentalDecorators": true,
       "paths": {
         "@/*": ["./*"]
       }
     }
   }
   ```

2. **Install a component directly from the local registry JSON URL**:

   ```sh
   pnpm dlx shadcn@latest add http://localhost:4321/r/magnetic.json
   ```

   Since there's no `components.json` yet, the CLI prompts to bootstrap one
   inline — this single step installs Tailwind CSS v4, creates
   `app/globals.css`, and generates `components.json`, `lib/utils.ts`, and a
   base `components/ui/button.tsx`. It then drops the Web Component source at
   `components/motion-kit/magnetic-element.ts` and installs its dependencies
   (`lit`, `gsap`).

   Don't forget to load the generated stylesheet from `app/layout.tsx`:

   ```tsx
   import "./globals.css";
   ```

## Using the component

Components from this registry are framework-agnostic **Web Components**
(Custom Elements). They must be imported in **client components only** —
add `"use client"` at the top of any file that uses them:

```tsx
"use client";
import "@/components/motion-kit/magnetic-element";

export default function Home() {
  return (
    <motion-magnetic strength="0.5">
      <button className="rounded-full bg-foreground px-8 py-4 text-background">
        Hover me
      </button>
    </motion-magnetic>
  );
}
```

### Why client components only?

Motion Kit components use GSAP animations and browser APIs that require the
JavaScript runtime to execute. They cannot run during server-side rendering,
so any page or component using them must be a Client Component with the
`"use client"` directive.

## Commands

| Command        | Action                                       |
| :------------- | :------------------------------------------- |
| `pnpm install` | Installs dependencies                         |
| `pnpm dev`     | Starts local dev server at `localhost:3000`  |
| `pnpm build`   | Build your production site to `./.next/`     |
| `pnpm start`   | Start production server                      |
