<script setup lang="ts">
import { onMounted, ref } from "vue";
import { mountComponentTestSpec } from "@/lib/testing/dom";
import type { ComponentTestRenderSpec } from "@/lib/testing/spec";

interface Props {
  spec: ComponentTestRenderSpec;
}

const props = defineProps<Props>();
const container = ref<HTMLDivElement | null>(null);

onMounted(() => {
  if (!container.value) return;
  return mountComponentTestSpec(container.value, props.spec);
});
</script>

<template>
  <div ref="container" class="flex h-full w-full items-center justify-center"></div>
</template>
