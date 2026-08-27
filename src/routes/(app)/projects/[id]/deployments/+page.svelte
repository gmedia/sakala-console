<script lang="ts">
	import { page } from '$app/stores';
	import { createDeploymentsQuery } from '$lib/features/projects/queries';
	import {
		CircleNotch,
		WarningCircle,
		List,
		MagnifyingGlass,
		Empty,
		CaretLeft,
		CaretRight
	} from 'phosphor-svelte';
	import { formatDate } from '$lib/utils/date';

	const query = createDeploymentsQuery(() => $page.params.id || '');

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

	function getBadgeStyle(status: string) {
		if (status === 'success') return 'bg-success/10 text-success';
		if (status === 'failed' || status === 'cancelled') return 'bg-error/10 text-error';
		if (status === 'running' || status === 'building' || status === 'queued')
			return 'bg-warning/10 text-warning';
		return 'bg-muted/20 text-muted';
	}

	function getDotStyle(status: string) {
		if (status === 'success') return 'bg-success';
		if (status === 'failed' || status === 'cancelled') return 'bg-error';
		if (status === 'running' || status === 'building' || status === 'queued') return 'bg-warning';
		return 'bg-muted';
	}

	function formatRelativeTime(dateString: string) {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Baru saja';
		if (diffMins < 60) return `${diffMins} menit lalu`;
		if (diffHours < 24) return `${diffHours} jam lalu`;
		if (diffDays < 2) return `Kemarin`;
		if (diffDays < 30) return `${diffDays} hari lalu`;
		return formatDate(dateString);
	}

	function formatDuration(startStr: string | null, finishStr: string | null) {
		if (!startStr || !finishStr) return 'Durasi tidak diketahui';
		const start = new Date(startStr);
		const finish = new Date(finishStr);
		const diffMs = finish.getTime() - start.getTime();
		if (diffMs < 0) return 'Durasi tidak diketahui';

		const totalSeconds = Math.floor(diffMs / 1000);
		if (totalSeconds < 60) return `Durasi ${totalSeconds} detik`;

		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `Durasi ${mins}m ${secs}s`;
	}

	let filterDays = $state(30);
	const filterOptions = [7, 30, 90, 0];

	function toggleFilterDays() {
		const currentIndex = filterOptions.indexOf(filterDays);
		const nextIndex = (currentIndex + 1) % filterOptions.length;
		filterDays = filterOptions[nextIndex];
	}

	const filterText = $derived(filterDays === 0 ? 'Semua waktu' : `${filterDays} hari terakhir`);
</script>

<svelte:head><title>Deployments | Sakala Console</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<button
			onclick={toggleFilterDays}
			class="flex items-center w-35.75 h-6 rounded-none bg-primary-50 text-primary transition-colors hover:bg-primary-100"
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
				<div class="bg-white rounded-xl p-5 flex flex-col w-full h-67.25">
					<div class="flex items-start justify-between">
						<div class="flex flex-col gap-1">
							<h3 class="font-montserrat-semibold text-foreground text-base">
								Deployment #{deployment.sequence || 0}
							</h3>
							<div class="flex items-center gap-1.5 text-xs text-muted font-montserrat">
								<span>{deployment.branch || 'main'}</span>
								<span>&bull;</span>
								<span
									>{deployment.created_at ? formatRelativeTime(deployment.created_at) : '-'}</span
								>
							</div>
						</div>
						<div
							class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize {getBadgeStyle(
								deployment.status
							)}"
						>
							<span class="size-1.5 rounded-full {getDotStyle(deployment.status)}"></span>
							{deployment.status === 'running' ||
							deployment.status === 'building' ||
							deployment.status === 'queued'
								? 'Deploying'
								: deployment.status.replace('_', ' ')}
						</div>
					</div>

					<div
						class="bg-muted/10 rounded-xl px-4 flex flex-col items-center justify-center text-center gap-2 mt-4 w-full h-30 shrink-0"
					>
						<p class="text-sm font-montserrat-medium text-foreground line-clamp-2 leading-relaxed">
							{deployment.commit_message || 'Manual Deployment'}
						</p>
						{#if deployment.commit_sha}
							<span class="text-xs text-muted font-mono"
								>{deployment.commit_sha.substring(0, 7)}</span
							>
						{/if}
					</div>

					<div class="flex items-center justify-between mt-5">
						<span class="text-xs font-montserrat-semibold text-muted">
							{#if deployment.status === 'running' || deployment.status === 'building' || deployment.status === 'queued'}
								Tahap: {deployment.status}...
							{:else if deployment.status === 'failed' || deployment.status === 'cancelled'}
								Build error
							{:else}
								{formatDuration(deployment.started_at, deployment.finished_at)}
							{/if}
						</span>

						<button
							class="flex items-center justify-center w-21.5 h-7.75 border border-black text-foreground hover:bg-muted/10 rounded-lg text-xs font-montserrat-semibold transition-colors"
						>
							Lihat detail
						</button>
					</div>
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-center gap-2 mt-4 mb-8">
				<button
					onclick={() => currentPage > 1 && (currentPage -= 1)}
					disabled={currentPage === 1}
					class="flex items-center justify-center w-14 h-12 rounded-lg bg-white text-muted hover:text-foreground disabled:opacity-50 transition-colors"
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
							onclick={() => (currentPage = Number(pageNum))}
							class="flex items-center justify-center h-12 rounded-lg text-sm font-semibold transition-colors {currentPage ===
							pageNum
								? 'bg-primary text-white w-9.75'
								: 'bg-white text-muted hover:bg-muted/10 w-10.5'}"
						>
							{pageNum}
						</button>
					{/if}
				{/each}

				<button
					onclick={() => currentPage < totalPages && (currentPage += 1)}
					disabled={currentPage === totalPages}
					class="flex items-center justify-center w-14 h-12 rounded-lg bg-white text-muted hover:text-foreground disabled:opacity-50 transition-colors"
				>
					<CaretRight size={16} weight="bold" />
				</button>
			</div>
		{/if}
	{/if}
</div>
