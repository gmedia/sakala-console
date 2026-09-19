<script lang="ts">
	import { createDeploymentsQuery } from '../../queries';
	import type { DeploymentFilter } from '../../type';
	import {
		CircleNotch,
		WarningCircle,
		List,
		MagnifyingGlass,
		Empty,
		CaretLeft,
		CaretRight
	} from 'phosphor-svelte';
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

	const filterLabels: Record<DeploymentFilter, string> = {
		'7_days': '7 hari terakhir',
		'30_days': '30 hari terakhir',
		all: 'Semua waktu'
	};

	const filterText = $derived(filterLabels[selectedFilter]);

	const deployments = $derived(query.data?.data ?? []);
	const totalPages = $derived(query.data?.meta.last_page ?? 1);

	function getPaginationRange(current: number, total: number) {
		if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

		if (current <= 3) return [1, 2, 3, 4, '...', total];
		if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];

		return [1, '...', current - 1, current, current + 1, '...', total];
	}

	const paginationRange = $derived(getPaginationRange(currentPage, totalPages));
</script>

<div class="flex flex-col gap-6 w-full">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<button
			type="button"
			onclick={toggleFilter}
			class="flex items-center min-w-35.75 h-6 px-3 rounded-none bg-primary-50 text-primary transition-colors hover:bg-primary-100 cursor-pointer"
		>
			<span class="py-1">
				<List size={16} />
			</span>
			<span class="pl-2 text-[12px] font-montserrat-semibold">{filterText}</span>
		</button>

		<div class="relative w-54 h-10">
			<MagnifyingGlass size={16} class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
			<input
				type="text"
				placeholder="Search..."
				value={searchQuery}
				oninput={(e) => {
					searchQuery = e.currentTarget.value;
					currentPage = 1;
				}}
				class="w-full h-full bg-surface border border-border rounded-lg pl-11 pr-4 py-2 text-sm outline-none focus:border-primary transition-colors"
			/>
		</div>
	</div>

	{#if query.isPending}
		<div class="flex items-center justify-center p-24">
			<CircleNotch size={32} class="animate-spin text-muted" />
		</div>
	{:else if query.isError}
		<div
			class="p-6 bg-error/5 text-error rounded-xl flex items-center gap-3 border border-error/20"
		>
			<WarningCircle size={24} weight="fill" />
			<p class="font-medium text-sm">Gagal memuat riwayat deployment. Silakan coba lagi.</p>
		</div>
	{:else if deployments.length === 0 && !searchQuery.trim()}
		<div class="flex flex-col items-center justify-center mt-10 pb-24 gap-6">
			<div class="w-13 h-13 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
				<Empty size={32} weight="regular" />
			</div>
			<p class="text-foreground text-[20px] font-montserrat-light">
				Belum ada riwayat deployment untuk proyek ini.
			</p>
		</div>
	{:else if deployments.length === 0 && searchQuery.trim()}
		<div class="flex flex-col items-center justify-center mt-10 pb-24 gap-6">
			<div class="w-13 h-13 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
				<MagnifyingGlass size={32} weight="regular" />
			</div>
			<p class="text-foreground text-[20px] font-montserrat-light">
				Tidak ada deployment yang sesuai dengan pencarian.
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each deployments as deployment (deployment.id)}
				<DeploymentCard {deployment} />
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-4 mb-8">
				<button
					type="button"
					onclick={() => currentPage > 1 && (currentPage -= 1)}
					disabled={currentPage === 1}
					class="flex items-center justify-center w-14 h-12 rounded-lg bg-white text-muted hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer"
				>
					<CaretLeft size={16} weight="bold" />
				</button>

				{#each paginationRange as pageNum (pageNum)}
					{#if pageNum === '...'}
						<div
							class="flex items-center justify-center w-10.5 h-12 rounded-lg bg-white text-muted font-bold tracking-widest text-sm"
						>
							...
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (currentPage = Number(pageNum))}
							class="flex items-center justify-center h-12 rounded-lg text-sm font-semibold transition-colors cursor-pointer {currentPage ===
							pageNum
								? 'bg-primary text-white w-9.75'
								: 'bg-white text-muted hover:bg-muted/10 w-10.5'}"
						>
							{pageNum}
						</button>
					{/if}
				{/each}

				<button
					type="button"
					onclick={() => currentPage < totalPages && (currentPage += 1)}
					disabled={currentPage === totalPages}
					class="flex items-center justify-center w-14 h-12 rounded-lg bg-white text-muted hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer"
				>
					<CaretRight size={16} weight="bold" />
				</button>
			</div>
		{/if}
	{/if}
</div>
