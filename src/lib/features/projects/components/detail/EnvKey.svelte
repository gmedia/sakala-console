<script lang="ts">
	let { name }: { name: string } = $props();

	/** A long name breaks after an underscore, not in the middle of a word. */
	const parts = $derived(name.match(/[^_]+_*|_+/g) ?? [name]);
</script>

{#each parts as part, index (index)}{part}<wbr />{/each}
