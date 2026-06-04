<script lang="ts">
  import { onMount } from "svelte";
  import { mountComponentTestSpec } from "@/lib/component-test-dom";
  import type { ComponentTestRenderSpec } from "@/lib/component-test-spec";

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
