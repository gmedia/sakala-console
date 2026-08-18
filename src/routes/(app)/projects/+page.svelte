<script lang="ts">
	import CreateProjectHeroCard from '$lib/features/projects/components/create/CreateProjectHeroCard.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';
	import { mockProjects } from '$lib/features/projects/mock';
	import ProjectList from '$lib/features/projects/components/project/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/project/ProjectFilter.svelte';

	let search = $state('');
	let dateFilter: DateFilterValue = $state('30d');
	let currentPage = $state(1);
	const perPage = 6;

	$effect(() => {
		void search;
		void dateFilter;
		currentPage = 1;
	});
</script>

<svelte:head><title>Projects | Sakala Console</title></svelte:head>
<main class="flex flex-col gap-8">
	<CreateProjectHeroCard isEmpty={true} />

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
		<div class="flex items-center justify-between sm:justify-normal gap-4 w-full sm:flex-1">
			<h2 class="text-2xl font-semibold font-montserrat-semibold whitespace-nowrap">
				Recent Projects
			</h2>
			<ProjectFilter bind:value={dateFilter} />
		</div>
		<div class="relative w-full sm:max-w-max sm:flex-2">
			<SearchInput bind:value={search} placeholder="Cari.." />
		</div>
	</div>

	<ProjectList
		projects={mockProjects}
		isLoading={false}
		{perPage}
		{currentPage}
		onPageChange={(page) => (currentPage = page)}
		isError={null}
		{dateFilter}
		{search}
	/>
</main>
