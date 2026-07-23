<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';
	import { filterProjectsByDate, type DateFilterValue } from '$lib/features/projects/filters';

	type Props = {
		projects: Project[];
		dateFilter: DateFilterValue;
	};

	let { projects, dateFilter }: Props = $props();

	const filteredProjects = $derived(filterProjectsByDate(projects, dateFilter));
</script>

<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
	{#each filteredProjects as project (project.id)}
		<ProjectCard {...project} />
	{:else}
		<p class="text-muted text-center col-span-full">Tidak ada project</p>
	{/each}
</section>
