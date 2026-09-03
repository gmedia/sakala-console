<script lang="ts">
	import { createDeploymentsQuery } from '../../queries';
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

	const query = createDeploymentsQuery(() => projectId);

	let searchQuery = $state('');

	const filteredDeployments = $derived(
		(query.data ?? []).filter((d) => {
			if (!searchQuery) return true;
			const q = searchQuery.toLowerCase();
			const seqName = `deployment #${d.sequence || 0}`.toLowerCase();
			return seqName.includes(q);
		})
	);

	const itemsPerPage = 6;
	let currentPage = $state(1);

	$effect(() => {
		if (searchQuery !== undefined) {
			currentPage = 1;
		}
	});

	const totalPages = $derived(Math.ceil(filteredDeployments.length / itemsPerPage));

	const paginatedDeployments = $derived(
		filteredDeployments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	function getPaginationRange(current: number, total: number) {
		if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

		if (current <= 3) return [1, 2, 3, 4, '...', total];
		if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];

		return [1, '...', current - 1, current, current + 1, '...', total];
	}

	const paginationRange = $derived(getPaginationRange(currentPage, totalPages));

	let filterDays = $state(30);
	const filterOptions = [7, 30, 90, 0];

	function toggleFilterDays() {
		const currentIndex = filterOptions.indexOf(filterDays);
		const nextIndex = (currentIndex + 1) % filterOptions.length;
		filterDays = filterOptions[nextIndex];
	}

	const filterText = $derived(filterDays === 0 ? 'Semua waktu' : `${filterDays} hari terakhir`);
</script>

<div class="flex flex-col gap-6 w-full">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<button
			type="button"
			onclick={toggleFilterDays}
			class="flex items-center w-35.75 h-6 rounded-none bg-primary-50 text-primary transition-colors hover:bg-primary-100 cursor-pointer"
		>
			<span class="pl-3 py-1">
				<List size={16} />
			</span>
			<span class="pl-2 text-[12px] font-montserrat-semibold">{filterText}</span>
		</button>

		<div class="relative w-54 h-10">
			<MagnifyingGlass size={16} class="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
			<input
				type="text"
				placeholder="Search..."
				bind:value={searchQuery}
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
	{:else if query.data?.length === 0}
		<div class="flex flex-col items-center justify-center mt-10 pb-24 gap-6">
			<div class="w-13 h-13 rounded-xl bg-primary-50 flex items-center justify-center text-primary">
				<Empty size={32} weight="regular" />
			</div>
			<p class="text-foreground text-[20px] font-montserrat-light">
				Belum ada riwayat deployment untuk proyek ini.
			</p>
		</div>
	{:else if filteredDeployments.length === 0}
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
			{#each paginatedDeployments as deployment (deployment.id)}
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
