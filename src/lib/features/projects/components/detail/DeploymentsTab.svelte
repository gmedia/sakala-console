<script lang="ts">
	import { createDeploymentsQuery } from '../../queries';
	import type { DeploymentFilter } from '../../type';
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import List from 'phosphor-svelte/lib/List';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import DeploymentCard from './DeploymentCard.svelte';

	let { projectId }: { projectId: string } = $props();

	const filterOptions: DeploymentFilter[] = ['30_days', '7_days', 'all'];
	let selectedFilter = $state<DeploymentFilter>('30_days');
	let searchQuery = $state('');
	let currentPage = $state(1);

	const query = createDeploymentsQuery(
		() => projectId,
		() => ({
			page: currentPage,
			per_page: 6,
			search: searchQuery.trim() || undefined,
			filter: selectedFilter
		})
	);

	function toggleFilter() {
		const currentIndex = filterOptions.indexOf(selectedFilter);
		const nextIndex = (currentIndex + 1) % filterOptions.length;
		selectedFilter = filterOptions[nextIndex];
		currentPage = 1;
	}

	function showAllTime() {
		selectedFilter = 'all';
		currentPage = 1;
	}

	const filterLabels: Record<DeploymentFilter, string> = {
		'7_days': '7 hari terakhir',
		'30_days': '30 hari terakhir',
		all: 'Semua waktu'
	};

	const filterText = $derived(filterLabels[selectedFilter]);

	const deployments = $derived(query.data?.data ?? []);
	const totalPages = $derived(query.data?.meta.last_page ?? 1);
</script>

<div class="flex flex-col gap-6 w-full">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<Button variant="secondary" size="sm" class="w-fit" onclick={toggleFilter}>
			<List size={16} aria-hidden="true" />
			{filterText}
		</Button>

		<SearchInput
			class="w-full md:w-54"
			placeholder="Cari deployment"
			debounce={300}
			onSearch={(value) => {
				searchQuery = value;
				currentPage = 1;
			}}
		/>
	</div>

	{#if query.isPending}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" role="status">
			<span class="sr-only">Memuat riwayat deployment...</span>
			{#each [1, 2, 3] as item (item)}
				<div class="surface-card flex flex-col gap-3 p-5" aria-hidden="true">
					<div class="skeleton h-5 w-2/3"></div>
					<div class="skeleton h-4 w-1/3"></div>
					<div class="skeleton h-24 w-full"></div>
					<div class="skeleton h-8 w-1/2"></div>
				</div>
			{/each}
		</div>
	{:else if query.isError}
		<div
			role="alert"
			class="p-6 bg-error/5 text-error rounded-card flex flex-wrap items-center gap-3 border border-error/20"
		>
			<WarningCircle size={24} weight="fill" />
			<p class="min-w-0 flex-1 font-medium text-sm">
				Gagal memuat riwayat deployment. Riwayatnya sendiri tidak hilang.
			</p>
			<Button variant="secondary" onclick={() => query.refetch()} disabled={query.isFetching}>
				{query.isFetching ? 'Memuat...' : 'Coba lagi'}
			</Button>
		</div>
	{:else if deployments.length === 0 && !searchQuery.trim() && selectedFilter !== 'all'}
		<EmptyState
			icon={ClockCounterClockwise}
			title="Tidak ada deployment"
			description={`Tidak ada deployment dalam ${filterText}.`}
		>
			{#snippet action()}
				<Button variant="secondary" onclick={showAllTime}>Lihat semua waktu</Button>
			{/snippet}
		</EmptyState>
	{:else if deployments.length === 0 && !searchQuery.trim()}
		<EmptyState
			icon={ClockCounterClockwise}
			title="Belum ada riwayat"
			description="Belum ada riwayat deployment untuk proyek ini."
		/>
	{:else if deployments.length === 0 && searchQuery.trim()}
		<EmptyState
			icon={MagnifyingGlass}
			title="Tidak ada yang cocok"
			description="Tidak ada deployment yang sesuai dengan pencarian."
		/>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each deployments as deployment (deployment.id)}
				<DeploymentCard {deployment} />
			{/each}
		</div>

		<Pagination {currentPage} {totalPages} onPageChange={(next) => (currentPage = next)} />
	{/if}
</div>
