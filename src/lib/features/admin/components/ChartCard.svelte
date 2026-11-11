<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		title: string;
		/** What is counted and over which range: every chart says both. */
		subtitle: string;
		loading?: boolean;
		empty?: boolean;
		emptyText?: string;
		/** The same numbers as a table, for keyboard, screen reader, and exact reading. */
		table?: Snippet;
		children: Snippet;
		class?: string;
	};

	let {
		title,
		subtitle,
		loading = false,
		empty = false,
		emptyText = 'Belum ada data di rentang ini.',
		table,
		children,
		class: className = ''
	}: Props = $props();
</script>

<section class={cn('surface-card flex min-w-0 flex-col gap-4 p-5', className)} aria-busy={loading}>
	<div>
		<h2 class="text-base text-foreground">{title}</h2>
		<p class="mt-0.5 text-xs text-muted">{subtitle}</p>
	</div>
	{#if loading}
		<div class="skeleton h-40 w-full"></div>
	{:else if empty}
		<p class="rounded-control bg-background-soft px-4 py-10 text-center text-sm text-muted">
			{emptyText}
		</p>
	{:else}
		{@render children()}
		{#if table}
			<details class="text-sm">
				<summary
					class="inline-flex min-h-6 cursor-pointer items-center font-medium text-primary-dark"
				>
					Lihat sebagai tabel
				</summary>
				<div class="mt-2 overflow-x-auto">{@render table()}</div>
			</details>
		{/if}
	{/if}
</section>
