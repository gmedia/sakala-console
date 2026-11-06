<script lang="ts">
	import type { Repository } from '../../type';
	import RepositoryListItem from './RepositoryListItem.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	type Props = {
		repositories: Repository[];
		/** From the API's pagination, because the list holds one page only. */
		total: number;
		currentPage: number;
		lastPage: number;
		selectedId?: string | null;
		fetching?: boolean;
		onSelect?: (id: string) => void;
		onPageChange?: (page: number) => void;
	};

	let {
		repositories,
		total,
		currentPage,
		lastPage,
		selectedId,
		fetching = false,
		onSelect,
		onPageChange = () => {}
	}: Props = $props();
</script>

<div
	role="radiogroup"
	aria-label="Pilih repository"
	aria-busy={fetching}
	class="flex flex-col overflow-hidden rounded-card border border-border transition-opacity duration-150 {fetching
		? 'opacity-60'
		: ''}"
>
	{#each repositories as repository (repository.id)}
		<RepositoryListItem {repository} selected={repository.id === selectedId} {onSelect} />
	{/each}
</div>
<div class="flex w-full flex-wrap items-center justify-between gap-2">
	<p class="text-sm" role="status">
		Menampilkan <span class="font-semibold">{repositories.length}</span> dari
		<span class="font-semibold">{total}</span> repository
	</p>
	{#if lastPage > 1}
		<Pagination {currentPage} totalPages={lastPage} {onPageChange} disabled={fetching} />
	{/if}
</div>
