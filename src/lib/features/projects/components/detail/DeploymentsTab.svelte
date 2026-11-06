<script lang="ts">
	import { createDeploymentsQuery } from '../../queries';
	import type { DeploymentFilter } from '../../type';
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import ProjectFilter from '../project/ProjectFilter.svelte';
	import DeploymentRow from './DeploymentRow.svelte';

	let { projectId }: { projectId: string } = $props();

	const PER_PAGE = 6;

	const filterOptions: { label: string; value: DeploymentFilter }[] = [
		{ label: 'Semua waktu', value: 'all' },
		{ label: '7 hari terakhir', value: '7_days' },
		{ label: '30 hari terakhir', value: '30_days' }
	];

	let selectedFilter = $state<DeploymentFilter>('all');
	let searchQuery = $state('');
	let currentPage = $state(1);

	const query = createDeploymentsQuery(
		() => projectId,
		() => ({
			page: currentPage,
			per_page: PER_PAGE,
			search: searchQuery.trim() || undefined,
			filter: selectedFilter
		})
	);

	function changeFilter(next: DeploymentFilter) {
		selectedFilter = next;
		currentPage = 1;
	}

	const deployments = $derived(query.data?.data ?? []);
	const totalPages = $derived(query.data?.meta.last_page ?? 1);
	const narrowed = $derived(Boolean(searchQuery.trim()) || selectedFilter !== 'all');
	// A few deployments fit on one page. Controls appear when there is something to narrow down, and
	// stay while narrowing, or the way back would be gone.
	const showControls = $derived(narrowed || totalPages > 1);
</script>

<div class="flex w-full flex-col gap-4">
	{#if showControls}
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<ProjectFilter
				bind:value={() => selectedFilter, changeFilter}
				options={filterOptions}
				name="Filter waktu"
			/>

			<SearchInput
				class="w-full sm:w-64"
				placeholder="Cari deployment"
				debounce={300}
				onSearch={(value) => {
					searchQuery = value;
					currentPage = 1;
				}}
			/>
		</div>
	{/if}

	{#if query.isPending}
		<ul class="surface-card divide-y divide-border" role="status">
			<span class="sr-only">Memuat riwayat deployment...</span>
			{#each [1, 2, 3, 4] as item (item)}
				<li class="flex items-center gap-3 px-4 py-3" aria-hidden="true">
					<div class="skeleton size-5 rounded-full"></div>
					<div class="skeleton h-4 flex-1"></div>
					<div class="skeleton h-4 w-20"></div>
				</li>
			{/each}
		</ul>
	{:else if query.isError}
		<div
			role="alert"
			class="flex flex-wrap items-center gap-3 rounded-card border border-error/20 bg-error/5 p-4 text-error"
		>
			<WarningCircle size={24} weight="fill" aria-hidden="true" />
			<p class="min-w-0 flex-1 text-sm font-medium">
				Gagal memuat riwayat deployment. Riwayatnya sendiri tidak hilang.
			</p>
			<Button variant="secondary" onclick={() => query.refetch()} disabled={query.isFetching}>
				{query.isFetching ? 'Memuat...' : 'Coba lagi'}
			</Button>
		</div>
	{:else if deployments.length === 0 && searchQuery.trim()}
		<EmptyState
			icon={MagnifyingGlass}
			title="Tidak ada yang cocok"
			description="Tidak ada deployment yang sesuai dengan pencarian."
		/>
	{:else if deployments.length === 0 && selectedFilter !== 'all'}
		<EmptyState
			icon={ClockCounterClockwise}
			title="Tidak ada deployment"
			description={`Tidak ada deployment dalam ${filterOptions.find((option) => option.value === selectedFilter)?.label}.`}
		>
			{#snippet action()}
				<Button variant="secondary" onclick={() => changeFilter('all')}>Lihat semua waktu</Button>
			{/snippet}
		</EmptyState>
	{:else if deployments.length === 0}
		<EmptyState
			icon={ClockCounterClockwise}
			title="Belum ada riwayat"
			description="Proyek ini belum pernah di-deploy. Jalankan deploy pertamanya lewat tombol di atas, dan hasilnya muncul di sini."
		/>
	{:else}
		<div class="@container surface-card overflow-hidden">
			<div
				aria-hidden="true"
				class="hidden gap-x-3 border-b border-border px-4 py-2 text-xs text-muted @3xl:grid @3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem]"
			>
				<span>Status</span>
				<span>Nomor</span>
				<span>Commit</span>
				<span>SHA</span>
				<span>Branch</span>
				<span>Waktu</span>
				<span class="text-right">Durasi</span>
			</div>
			<ul class="divide-y divide-border">
				{#each deployments as deployment (deployment.id)}
					<DeploymentRow {deployment} />
				{/each}
			</ul>
		</div>

		<Pagination {currentPage} {totalPages} onPageChange={(next) => (currentPage = next)} />
	{/if}
</div>
