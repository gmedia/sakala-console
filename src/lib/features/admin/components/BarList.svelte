<script lang="ts">
	// Links here are resolve() output, some with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { cn } from '$lib/utils/cn';
	import { formatNumber, formatShare } from '../format';

	type Row = { key: string; label: string; value: number; help?: string; href?: string };

	type Props = {
		rows: Row[];
		/** The whole the shares are taken of; without it rows show counts only. */
		total?: number;
		tone?: 'primary' | 'error';
		unit?: string;
	};

	let { rows, total, tone = 'primary', unit = '' }: Props = $props();

	const max = $derived(Math.max(1, ...rows.map((row) => row.value)));
</script>

<ul class="flex flex-col gap-3">
	{#each rows as row (row.key)}
		{@const share = total !== undefined ? formatShare(row.value, total) : null}
		<li>
			<div class="flex items-baseline justify-between gap-3 text-sm">
				{#if row.href}
					<a
						href={row.href}
						class="inline-flex min-h-6 min-w-0 items-center truncate font-medium text-foreground underline underline-offset-2"
						title={row.help}>{row.label}</a
					>
				{:else}
					<span class="min-w-0 truncate font-medium text-foreground" title={row.help}
						>{row.label}</span
					>
				{/if}
				<span class="shrink-0 text-foreground tabular-nums">
					{#if share}<span class="font-semibold">{share}</span>
						<span class="text-muted">({formatNumber(row.value)})</span>
					{:else}{formatNumber(row.value)} {unit}{/if}
				</span>
			</div>
			<div class="mt-1.5 h-2 w-full rounded-full bg-background-soft" aria-hidden="true">
				<div
					class={cn('h-2 rounded-full', tone === 'error' ? 'bg-error-base' : 'bg-primary')}
					style:width={`${(row.value / max) * 100}%`}
				></div>
			</div>
		</li>
	{/each}
</ul>
