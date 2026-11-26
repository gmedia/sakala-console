<script lang="ts">
	// Links here are resolve() output with a query string added, which the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { cn } from '$lib/utils/cn';
	import { formatNumber } from '../format';

	type Item = {
		key: string;
		/** After the number: "offline", "token dicabut". */
		label: string;
		/** Undefined while loading. */
		count: number | undefined;
		/** The list filtered to what the count counts. */
		href: string;
		/** Above zero this needs a look, so it takes the error colour (the words still say it). */
		alert?: boolean;
	};

	let { label, items }: { label: string; items: Item[] } = $props();
</script>

<!-- Counts as badges that filter the list: status as a badge, not a card with a sentence. -->
<ul class="flex flex-wrap items-center gap-2" aria-label={label}>
	{#each items as item (item.key)}
		{@const loud = item.alert && (item.count ?? 0) > 0}
		<li>
			<a
				href={item.href}
				class={cn(
					'inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap underline-offset-2 hover:underline',
					loud
						? 'border-error/20 bg-error/10 text-error'
						: 'border-border bg-background-soft text-foreground'
				)}
			>
				{#if item.count === undefined}
					<span class="skeleton inline-block h-3 w-4" aria-hidden="true"></span>
					<span class="sr-only">Memuat</span>
				{:else}
					<span class="tabular-nums">{formatNumber(item.count)}</span>
				{/if}
				{item.label}
			</a>
		</li>
	{/each}
</ul>
