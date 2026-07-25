<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';
	import ProjectCardSkeleton from '$lib/features/projects/components/ProjectCardSkeleton.svelte';
	import { filterProjects, type DateFilterValue } from '$lib/features/projects/filters';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		projects: Project[];
		dateFilter: DateFilterValue;
		search: string;
		isError?: Error | string | null;
		isLoading?: boolean;
		onRetry?: () => void;
	};

	let {
		projects,
		dateFilter,
		search,
		isError = null,
		isLoading = false,
		onRetry
	}: Props = $props();
	let expanded = $state(false);

	const skeletonCount = 6;
	const skeletons = Array.from({ length: skeletonCount }, (_, i) => i);
	const filteredProjects = $derived(filterProjects(projects, { date: dateFilter, search }));
	const visibleProjects = $derived(expanded ? filteredProjects : filteredProjects.slice(0, 6));
</script>

<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
	{#if isLoading}
		{#each skeletons as i (i)}
			<ProjectCardSkeleton />
		{/each}
	{:else if isError}
		<EmptyState
			iconSrc="/icons/warning.svg"
			tone="failed"
			title="Gagal memuat project"
			description="Terjadi kendala saat mengambil data dari server. Ini bukan karena project kamu hilang, coba muat ulang halamannya."
			class="col-span-full bg-transparent border-none shadow-none"
		>
			{#snippet action()}
				<button
					class="inline-flex gap-2 bg-primary text-white border border-muted/20 rounded-lg py-3 px-4 font-montserrat-semibold cursor-pointer"
					onclick={onRetry}><img src="/icons/retry.svg" alt="coba lagi" /> Coba lagi</button
				>
			{/snippet}
		</EmptyState>
	{:else if projects.length === 0}
		<EmptyState
			iconSrc="/icons/notFound.svg"
			title="Belum ada deployment"
			description="Kamu belum punya project apapun. Deploy project pertamamu untuk melihat riwayatnya muncul di sini."
			class="col-span-full bg-transparent border-none shadow-none"
		/>
	{:else if filteredProjects.length === 0}
		<EmptyState
			iconSrc="/icons/notFound.svg"
			title="Tidak menemukan project"
			description="Project yang kamu cari tidak ditemukan. Coba periksa kembali kata kunci pencarianmu atau filter tanggal yang digunakan."
			class="col-span-full bg-transparent border-none shadow-none"
		/>
	{:else}
		{#each visibleProjects as project (project.id)}
			<ProjectCard {...project} loading={true} />
		{/each}
	{/if}
</section>
{#if !expanded && filteredProjects.length > 6}
	<button
		class="inline-flex gap-2 items-center justify-center mx-auto px-4 py-2 bg-white border border-muted/20 rounded-xl font-montserrat-semibold hover:cursor-pointer"
		onclick={() => (expanded = true)}
	>
		Muat Lebih Banyak <img
			src="/icons/chevron-down.svg"
			alt="chevron down"
			class="mx-auto w-4 h-4"
		/>
	</button>
{/if}
