<script lang="ts">
	import { formatNumber } from '../format';

	type Column = { label: string; value: number; description: string };

	type Props = {
		columns: Column[];
		/** One sentence for screen readers, with the total and the busiest column. */
		summary: string;
	};

	let { columns, summary }: Props = $props();

	const max = $derived(Math.max(1, ...columns.map((column) => column.value)));
	// Every label fits up to 14 columns; past that every other one, so they never collide.
	const labelEvery = $derived(columns.length > 14 ? Math.ceil(columns.length / 10) : 1);
	const showValues = $derived(columns.length <= 14);
</script>

<!-- One series, one hue. Exact numbers are in the table below the chart. -->
<div role="img" aria-label={summary} class="flex h-48 items-end gap-1 sm:gap-2">
	{#each columns as column, index (column.label + index)}
		<div
			class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
			title={column.description}
		>
			{#if showValues}
				<span class="text-xs font-medium text-foreground tabular-nums"
					>{formatNumber(column.value)}</span
				>
			{/if}
			<div
				class="w-full max-w-12 rounded-t-[4px] bg-primary"
				style:height={`${Math.max((column.value / max) * 100, column.value > 0 ? 3 : 0)}%`}
			></div>
			<div class="h-px w-full bg-border-strong"></div>
			<span class="h-4 w-full truncate text-center text-xs text-muted">
				{index % labelEvery === 0 ? column.label : ''}
			</span>
		</div>
	{/each}
</div>
