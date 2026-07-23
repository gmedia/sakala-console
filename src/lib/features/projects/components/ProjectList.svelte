<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';
	import { filterProjects, type DateFilterValue } from '$lib/features/projects/filters';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	type Props = {
		projects: Project[];
		dateFilter: DateFilterValue;
		search: string;
	};

	let { projects, dateFilter, search }: Props = $props();

	const filteredProjects = $derived(filterProjects(projects, { date: dateFilter, search }));
</script>

<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
	{#if filteredProjects.length === 0}
		<EmptyState
			iconSrc="/icons/notFound.svg"
			title="Tidak menemukan project"
			description="Project yang kamu cari tidak ditemukan. Coba periksa kembali kata kunci pencarianmu atau filter tanggal yang digunakan."
			class="col-span-full bg-transparent border-none shadow-none"
		/>
	{:else}
		{#each filteredProjects as project (project.id)}
			<ProjectCard {...project} />
		{:else}
			<EmptyState
				iconSrc="/icons/notFound.svg"
				title="Belum ada deployment"
				description="Kamu belum punya project apapun. Deploy project pertamamu untuk melihat riwayatnya muncul di sini."
				class="col-span-full bg-transparent border-none shadow-none"
			/>
		{/each}
	{/if}
</section>
