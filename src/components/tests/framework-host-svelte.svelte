<script lang="ts">
  import { onMount } from "svelte";
  import { mountComponentTestSpec } from "@/lib/testing/dom";
  import type { ComponentTestRenderSpec } from "@/lib/testing/spec";

  export let spec: ComponentTestRenderSpec;

  let container: HTMLDivElement;

  onMount(() => {
    return mountComponentTestSpec(container, spec);
  });
</script>

<div
  bind:this={container}
  class="flex h-full w-full items-center justify-center"
></div>
