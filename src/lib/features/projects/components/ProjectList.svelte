<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';
	import { filterProjects, type DateFilterValue } from '$lib/features/projects/filters';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		projects: Project[];
		dateFilter: DateFilterValue;
		search: string;
		isError?: Error | string | null;
		onRetry?: () => void;
	};

	let { projects, dateFilter, search, isError = null, onRetry }: Props = $props();
	let expanded = $state(false);

	const filteredProjects = $derived(filterProjects(projects, { date: dateFilter, search }));
	const visibleProjects = $derived(expanded ? filteredProjects : filteredProjects.slice(0, 6));
</script>

<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
	{#if isError}
		<EmptyState
			iconSrc="/icons/notFound.svg"
			title="Terjadi kesalahan"
			description={typeof isError === 'string' ? isError : 'Terjadi kesalahan saat memuat project.'}
			class="col-span-full bg-transparent border-none shadow-none"
		>
			{#snippet action()}
				<button
					class="bg-white border border-muted/20 rounded-xl p-3 font-montserrat-semibold cursor-pointer"
					onclick={onRetry}>Coba lagi...</button
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
			<ProjectCard {...project} />
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
