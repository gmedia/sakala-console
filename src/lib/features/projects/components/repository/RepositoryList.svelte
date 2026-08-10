<script lang="ts">
	import { CircleOff } from '@lucide/svelte';
	import type { Repository } from '../../type';
	import RepositoryListItem from './RepositoryListItem.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import RepositoryListSkeleton from './RepositoryListSkeleton.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		repositories: Repository[];
		selectedId?: string | null;
		loading?: boolean;
		onSelect?: (id: string) => void;
		currentPage?: number;
		perPage?: number;
		onPageChange?: (page: number) => void;
	};

	let {
		repositories,
		loading = false,
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

{#if loading}
	<div class="flex flex-col">
		{#each Array(5) as i (i)}
			<RepositoryListSkeleton />
		{/each}
	</div>
{:else if repositories.length === 0}
	<EmptyState
		icon={CircleOff}
		tone="muted"
		title="Tidak menemukan repository"
		description="Kamu belum memiliki repository yang bisa ditambahkan ke project."
		class="col-span-full bg-transparent border-none shadow-none"
	/>
{:else}
	<div
		role="radiogroup"
		aria-label="Pilih repository"
		class="flex flex-col overflow-hidden rounded-xl border border-muted/40"
	>
		{#each visibleRepositories as repository (repository.id)}
			<RepositoryListItem {repository} selected={repository.id === selectedId} {onSelect} />
		{/each}
	</div>
	<div class="flex w-full justify-between items-center">
		<p class="text-sm">
			Menampilkan <span class="font-montserrat-semibold">{visibleRepositories.length}</span> dari
			<span class="font-montserrat-semibold">{repositories.length}</span> repository
		</p>
		{#if totalPages > 1}
			<Pagination {currentPage} {totalPages} {onPageChange} />
		{/if}
	</div>
{/if}
