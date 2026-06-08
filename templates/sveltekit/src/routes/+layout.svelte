<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$lib/components/motion-kit/magnetic-element';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
