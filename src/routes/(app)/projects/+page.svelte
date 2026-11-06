<script lang="ts">
	import CreateProjectHeroCard from '$lib/features/projects/components/create/CreateProjectHeroCard.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import ProjectList from '$lib/features/projects/components/project/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/project/ProjectFilter.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';
	import PilotQuotaNotice from '$lib/features/projects/components/create/PilotQuotaNotice.svelte';
	import { createListProjectsQuery, createPilotLimitsQuery } from '$lib/features/projects/queries';

	let search = $state('');
	let filter = $state<DateFilterValue>('30_days');
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

	const isCurrentResultEmpty = $derived(
		!projectsQuery.isPending && (projectsQuery.data?.projects.length ?? 0) === 0
	);

	const hasAnyProjectQuery = createListProjectsQuery(
		() => ({ page: 1, per_page: 1, filter: 'all' }),
		() => ({ enabled: isCurrentResultEmpty })
	);

	const isTrulyEmpty = $derived(isCurrentResultEmpty && hasAnyProjectQuery.data?.meta.total === 0);

	const pilotLimitsQuery = createPilotLimitsQuery();
</script>

<svelte:head><title>Proyek | Sakala Console</title></svelte:head>
<div class="flex flex-col gap-8">
	<CreateProjectHeroCard isEmpty={isTrulyEmpty} />

	<PilotQuotaNotice limits={pilotLimitsQuery.data} />

	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between w-full">
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 w-full lg:flex-1">
			<h2 class="text-2xl font-semibold font-montserrat-semibold whitespace-nowrap">
				Proyek Terbaru
			</h2>
			{#if !isTrulyEmpty}
				<ProjectFilter bind:value={filter} />
			{/if}
		</div>
		{#if !isTrulyEmpty}
			<div class="relative w-full lg:max-w-max lg:flex-2">
				<SearchInput
					placeholder="Cari proyek"
					debounce={300}
					onSearch={(value) => (search = value)}
				/>
			</div>
		{/if}
	</div>

	<ProjectList
		projects={projectsQuery.data?.projects ?? []}
		isAccountEmpty={isTrulyEmpty}
		isCheckingEmptyState={isCurrentResultEmpty && hasAnyProjectQuery.isPending}
		currentPage={projectsQuery.data?.meta.current_page ?? currentPage}
		totalPages={projectsQuery.data?.meta.last_page ?? 1}
		isLoading={projectsQuery.isPending}
		isFetching={projectsQuery.isFetching}
		isError={projectsQuery.error}
		onRetry={() => {
			projectsQuery.refetch();
		}}
		onPageChange={(page) => (currentPage = page)}
	/>
</div>
