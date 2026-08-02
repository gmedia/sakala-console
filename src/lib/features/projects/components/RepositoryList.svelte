<script lang="ts">
	import type { Repository } from '../type';
	import RepositoryListItem from './RepositoryListItem.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';

	type Props = {
		repositories: Repository[];
		selectedId?: string | null;
		onSelect?: (id: string) => void;
		currentPage?: number;
		perPage?: number;
		onPageChange?: (page: number) => void;
	};

	let {
		repositories,
		selectedId = $bindable(),
		onSelect,
		currentPage = 1,
		perPage = 5,
		onPageChange = () => {}
	}: Props = $props();

	const totalPages = $derived(Math.ceil(repositories.length / perPage));
	const visibleRepositories = $derived(
		repositories.slice((currentPage - 1) * perPage, currentPage * perPage)
	);
</script>

<p class="text-sm">
	Menampilkan <span class="font-montserrat-semibold">{visibleRepositories.length}</span> dari
	<span class="font-montserrat-semibold">{repositories.length}</span> repository
</p>
<div role="radiogroup" aria-label="Pilih repository" class="flex flex-col">
	{#each visibleRepositories as repository (repository.id)}
		<RepositoryListItem {repository} selected={repository.id === selectedId} {onSelect} />
	{/each}
</div>
<Pagination {currentPage} {totalPages} {onPageChange} />
