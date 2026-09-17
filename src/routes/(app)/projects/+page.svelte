<script lang="ts">
	import CreateProjectHeroCard from '$lib/features/projects/components/create/CreateProjectHeroCard.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import ProjectList from '$lib/features/projects/components/project/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/project/ProjectFilter.svelte';
	import type { ProjectsQueryParams } from '$lib/api/resources/projects';
	import { createListProjectsQuery } from '$lib/features/projects/queries';

	let search = $state('');
	let filter = $state<NonNullable<ProjectsQueryParams['filter']>>('30_days');
	let currentPage = $state(1);
	const perPage = 6;

	$effect(() => {
		void search;
		void filter;
		currentPage = 1;
	});

	const projectsQuery = createListProjectsQuery(() => ({
		page: currentPage,
		per_page: perPage,
		search: search.trim() || undefined,
		filter
	}));
</script>

<svelte:head><title>Projects | Sakala Console</title></svelte:head>
<main class="flex flex-col gap-8">
	<CreateProjectHeroCard />

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
		<div class="flex items-center justify-between sm:justify-normal gap-4 w-full sm:flex-1">
			<h2 class="text-2xl font-semibold font-montserrat-semibold whitespace-nowrap">
				Recent Projects
			</h2>
			<ProjectFilter bind:value={filter} />
		</div>
		<div class="relative w-full sm:max-w-max sm:flex-2">
			<SearchInput bind:value={search} placeholder="Cari.." />
		</div>
	</div>

	<ProjectList
		projects={projectsQuery.data?.projects ?? []}
		total={projectsQuery.data?.meta.total ?? 0}
		currentPage={projectsQuery.data?.meta.current_page ?? currentPage}
		totalPages={projectsQuery.data?.meta.last_page ?? 1}
		isLoading={projectsQuery.isPending}
		isFetching={projectsQuery.isFetching}
		isError={projectsQuery.error}
		onRetry={() => {
			console.log('PROJECT RETRY CLICKED');
			projectsQuery.refetch();
		}}
		onPageChange={(page) => (currentPage = page)}
	/>
</main>
