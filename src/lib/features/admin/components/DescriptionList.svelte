<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Item = { label: string; value?: string | number | null; mono?: boolean; content?: Snippet };

	type Props = {
		items: Item[];
		/**
		 * Two columns from `sm` up: an operator scans more facts per screen, and the facts column of
		 * the form template is 48rem wide, so a label and its value still fit side by side.
		 */
		columns?: 1 | 2;
		class?: string;
	};

	let { items, columns = 1, class: className = '' }: Props = $props();
</script>

<!-- Every row has a bottom border; the last one sits under the card's edge (-mb-px, clipped). -->
<dl
	class={cn(
		'surface-card grid overflow-hidden',
		columns === 2 && 'sm:grid-cols-2 sm:[&>div:nth-child(odd)]:border-r',
		className
	)}
>
	{#each items as item (item.label)}
		<div
			class="-mb-px flex min-w-0 flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
		>
			<dt class="shrink-0 text-sm text-muted">{item.label}</dt>
			<dd
				class={cn(
					'min-w-0 text-sm wrap-anywhere text-foreground sm:text-right',
					item.mono ? 'font-mono' : 'font-medium'
				)}
			>
				{#if item.content}
					{@render item.content()}
				{:else}
					{item.value ?? '-'}
				{/if}
			</dd>
		</div>
	{/each}
</dl>
