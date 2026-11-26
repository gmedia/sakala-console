<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** The list, table, log, or chart, across the full width. */
		children: Snippet;
		/** One row above it: a status (badge or meter) on the left, the primary action on the right. */
		toolbar?: Snippet;
		/** Filters and search, only once there is something to narrow down. */
		controls?: Snippet;
	};

	let { children, toolbar, controls }: Props = $props();
</script>

<!-- List, table, log, and metrics template (docs/UI_GUIDELINES.md): full width, no side panel. -->
<div class="flex w-full min-w-0 flex-col gap-6" data-testid="list-page">
	{#if toolbar}
		<div class="flex flex-wrap items-center justify-between gap-4" data-testid="list-page-toolbar">
			{@render toolbar()}
		</div>
	{/if}
	{#if controls}
		<div
			class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
			data-testid="list-page-controls"
		>
			{@render controls()}
		</div>
	{/if}
	{@render children()}
</div>
