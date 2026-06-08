# Motion Blocks Next.js example

A minimal Next.js project used to test installing components from the Motion Blocks
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

From the monorepo:

```sh
node packages/motion-blocks-cli/dist/index.js add magnetic --cwd templates/nextjs
```

`components.json` is not used by Motion Blocks. If your project also uses shadcn/ui,
keep that file for the shadcn CLI only.

## Using the component

Components from this registry are framework-agnostic **Web Components**
(Custom Elements). They must be imported in **client components only** —
add `"use client"` at the top of any file that uses them:

```tsx
"use client";
import "@/components/motion-blocks/magnetic-element";

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

Motion Blocks components use GSAP animations and browser APIs that require the
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
