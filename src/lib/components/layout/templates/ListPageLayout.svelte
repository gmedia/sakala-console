<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		/** The list, table, log, or chart, across the full width. */
		children: Snippet;
		/** One row above it: a status (badge or meter) on the left, the primary action on the right. */
		toolbar?: Snippet;
		/** Filters and search, only once there is something to narrow down. */
		controls?: Snippet;
		/**
		 * From 1024 px up the page fills the window under the shell's header, so a log ends where the
		 * window does and scrolls inside itself. Its rows sit closer, to leave the log the height.
		 */
		fill?: boolean;
	};

	let { children, toolbar, controls, fill = false }: Props = $props();
</script>

<!-- List, table, log, and metrics template (docs/UI_GUIDELINES.md): full width, no side panel. -->
<div
	class={cn('flex w-full min-w-0 flex-col', fill ? 'gap-3 lg:h-[calc(100dvh-7.5rem)]' : 'gap-6')}
	data-testid="list-page"
>
	{#if toolbar}
		<div
			class={cn('flex flex-wrap items-center justify-between', fill ? 'gap-x-6 gap-y-1' : 'gap-4')}
			data-testid="list-page-toolbar"
		>
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
