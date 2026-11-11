<script lang="ts">
	import type { Snippet } from 'svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		id: string;
		/** The placeholder doubles as the accessible name, so it says what is searched. */
		searchLabel?: string;
		search?: string;
		onSearch?: (value: string) => void;
		filters?: Snippet;
		hasFilters: boolean;
		onReset: () => void;
	};

	let { id, searchLabel, search = '', onSearch, filters, hasFilters, onReset }: Props = $props();

	// The box keeps what is typed; the URL follows 300 ms after the last key.
	let text = $state('');
	let lastSearch: string | undefined;
	$effect.pre(() => {
		if (search !== lastSearch) {
			lastSearch = search;
			text = search;
		}
	});
</script>

<div class="mb-4 flex flex-wrap items-end gap-3">
	{#if onSearch && searchLabel}
		<div class="min-w-0 flex-1 basis-64">
			<label for={`${id}-search`} class="mb-1 block text-xs font-medium text-muted">Cari</label>
			<SearchInput
				id={`${id}-search`}
				bind:value={text}
				placeholder={searchLabel}
				debounce={300}
				{onSearch}
			/>
		</div>
	{/if}
	{#if filters}
		{@render filters()}
	{/if}
	{#if hasFilters}
		<Button variant="secondary" size="lg" onclick={onReset}>Hapus filter</Button>
	{/if}
</div>
