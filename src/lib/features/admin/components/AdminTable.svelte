<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Column = { label: string; class?: string; srOnly?: boolean };

	type Props = {
		/** Names the table for screen readers; the page heading already shows it. */
		caption: string;
		columns: Column[];
		loading?: boolean;
		/** A newer page is on its way while the old one stays on screen. */
		fetching?: boolean;
		empty?: boolean;
		emptyTitle?: string;
		emptyText?: string;
		rows: Snippet;
		class?: string;
	};

	let {
		caption,
		columns,
		loading = false,
		fetching = false,
		empty = false,
		emptyTitle = 'Tidak ada data',
		emptyText = '',
		rows,
		class: className = ''
	}: Props = $props();
</script>

<!-- Wide tables scroll inside their card, so the page itself never scrolls sideways. -->
<div
	class={cn(
		'surface-card relative overflow-x-auto',
		fetching && 'opacity-70 transition-opacity',
		className
	)}
	aria-busy={loading || fetching}
>
	<table class="w-full min-w-[40rem] border-collapse text-left text-sm">
		<caption class="sr-only">{caption}</caption>
		<thead>
			<tr class="border-b border-border">
				{#each columns as column (column.label)}
					<th
						scope="col"
						class={cn(
							'px-4 py-3 text-xs font-semibold tracking-wide whitespace-nowrap text-muted uppercase',
							column.class
						)}
					>
						<span class={column.srOnly ? 'sr-only' : undefined}>{column.label}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody class="divide-y divide-border">
			{#if loading}
				{#each [0, 1, 2, 3, 4] as row (row)}
					<tr>
						{#each columns as column (column.label)}
							<td class="px-4 py-4"><span class="skeleton block h-4 w-3/4"></span></td>
						{/each}
					</tr>
				{/each}
			{:else if empty}
				<tr>
					<td colspan={columns.length} class="px-4 py-12 text-center">
						<p class="text-sm font-semibold text-foreground">{emptyTitle}</p>
						{#if emptyText}
							<p class="mx-auto mt-1 max-w-md text-sm text-muted">{emptyText}</p>
						{/if}
					</td>
				</tr>
			{:else}
				{@render rows()}
			{/if}
		</tbody>
	</table>
</div>
{#if loading}
	<p class="sr-only" role="status">Sedang memuat</p>
{/if}
