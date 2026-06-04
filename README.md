# motion-kit-astro

Astro-native experiment for serving a custom `shadcn` registry with animated web components.

This repo now exposes registry JSON from `public/r` and keeps the source items in `src/registry/new-york/blocks`.

## Items

- `card-stack`
- `magnetic`
- `magnetic-lit`
- `split-hover`
- `split-reveal`
- `stacking-words`
- `text-loop`
- `text-repel`
- `text-scramble`
- `weight-wave`

## Local test

1. Start the registry host:

```sh
pnpm dev
```

2. In another Astro project, add the local registry namespace:

```sh
pnpm dlx shadcn@latest registry add @motion-kit=http://localhost:4321/r/{name}.json
```

3. Install one of the items:

```sh
pnpm dlx shadcn@latest add @motion-kit/magnetic
pnpm dlx shadcn@latest add @motion-kit/text-loop
pnpm dlx shadcn@latest add @motion-kit/card-stack
```

4. Import the installed files in the consumer app:

```astro
---
import "@/components/motion-kit/magnetic-element.ts"
---

<motion-magnetic>
  <button>Hover me</button>
</motion-magnetic>
```

## Notes

- A component is included in the registry when it defines `src/registry/<group>/<name>/component.json`.
- Update `registry.json`, the grouped `src/registry/<group>/registry.json` include files, and `public/r/registry.json` directly when you change the registry structure.
- The registry files served from `public/r` are still static JSON.
- The distributed items are Custom Elements and helper files, not React components.
- `pnpm registry:build` is reserved for later validation against the `shadcn` builder.
