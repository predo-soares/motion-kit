import assert from "node:assert/strict";
import test from "node:test";

import { getComponentTestSpec, renderSpecToHtml } from "./spec.ts";

const completeUsage = [
  {
    label: "Astro",
    code: `---
import "@/components/motion-blocks/media-card-element.ts";
---

<motion-media-card
  image="/images/your-image.jpg"
  video="https://example.com/video.mp4"
  poster="https://example.com/poster.jpg"
  logos='[{"name":"Motion Blocks","src":"/logos/motion.svg"}]'
  class="w-full"
/>`,
  },
  { label: "React", code: "import '@/components/motion-blocks/media-card-element.ts';" },
  { label: "Vue", code: "<script setup></script>" },
  { label: "Svelte", code: "<script></script>" },
];

test("getComponentTestSpec accepts published items with complete framework usage", () => {
  const spec = getComponentTestSpec({ usage: completeUsage });

  assert.ok(spec);
  assert.deepEqual(spec.frameworks, ["Astro", "React", "Vue", "Svelte"]);
  assert.equal(spec.renderSpec.tagName, "motion-media-card");
  assert.equal(spec.renderSpec.attributes.image, "/images/demos/sample-8.jpg");
  assert.equal(spec.renderSpec.attributes.video, "/images/demos/video.mp4");
  assert.equal(spec.renderSpec.attributes.poster, "/images/demos/sample-10.jpg");
  const logos = JSON.parse(String(spec.renderSpec.attributes.logos));
  assert.match(logos[0].src, /^data:image\/svg\+xml;utf8,/);
});

test("getComponentTestSpec rejects items missing required framework usage", () => {
  assert.equal(getComponentTestSpec({ usage: completeUsage.slice(0, 3) }), null);
});

test("renderSpecToHtml preserves normalized render data", () => {
  const spec = getComponentTestSpec({ usage: completeUsage });

  assert.ok(spec);
  assert.match(
    renderSpecToHtml(spec.renderSpec),
    /<motion-media-card .*image="\/images\/demos\/sample-8\.jpg"/,
  );
});
