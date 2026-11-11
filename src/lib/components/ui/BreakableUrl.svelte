<script lang="ts">
	let { text }: { text: string } = $props();

	/** Each part keeps its dot or hyphen, and the line may break after it, not inside a word. */
	const parts = $derived(text.match(/[^.-]+[.-]*|[.-]+/g) ?? [text]);
</script>

{#each parts as part, index (index)}{part}<wbr />{/each}
