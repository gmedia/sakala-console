<script lang="ts">
	import type { Snippet } from 'svelte';

	type Item = { label: string; value?: string | number | null; mono?: boolean; content?: Snippet };

	let { items, class: className = '' }: { items: Item[]; class?: string } = $props();
</script>

<dl class={`surface-card divide-y divide-border ${className}`}>
	{#each items as item (item.label)}
		<div
			class="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
		>
			<dt class="shrink-0 text-sm text-muted">{item.label}</dt>
			<dd
				class={`min-w-0 text-sm wrap-anywhere text-foreground sm:text-right ${item.mono ? 'font-mono' : 'font-medium'}`}
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
