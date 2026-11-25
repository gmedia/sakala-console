<script lang="ts">
	import { VALKEY_MODE } from '$lib/api/resources/valkeys';
	import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';
	import ArrowsCounterClockwise from 'phosphor-svelte/lib/ArrowsCounterClockwise';
	import { valkeyModeView } from '../presentation';

	/** The mode as an icon and a word, so it never rests on the icon alone. */
	let { mode }: { mode: string } = $props();

	const view = $derived(valkeyModeView(mode));
</script>

<span
	class="inline-flex items-center gap-1 rounded-control bg-background-soft px-1.5 py-0.5 text-xs font-medium text-foreground"
	data-testid="valkey-mode"
>
	{#if mode === VALKEY_MODE.persistent}
		<FloppyDisk size={12} aria-hidden="true" />
	{:else}
		<ArrowsCounterClockwise size={12} aria-hidden="true" />
	{/if}
	{view.label}
</span>
