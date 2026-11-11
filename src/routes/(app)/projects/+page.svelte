<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import CreateProjectHeroCard from '$lib/features/projects/components/create/CreateProjectHeroCard.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import ProjectList from '$lib/features/projects/components/project/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/project/ProjectFilter.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';
	import PilotQuotaNotice from '$lib/features/projects/components/create/PilotQuotaNotice.svelte';
	import { createListProjectsQuery, createPilotLimitsQuery } from '$lib/features/projects/queries';
	import { useProjectListLive } from '$lib/features/projects/use-project-list-live.svelte';

	const perPage = 6;

	let search = $state('');
	let filter = $state<DateFilterValue>('all');
	let currentPage = $state(1);

	$effect(() => {
		void search;
		void filter;
		currentPage = 1;
	});

	const projectsQuery = createListProjectsQuery(
		() => ({
			page: currentPage,
			per_page: perPage,
			search: search.trim() || undefined,
			filter
		}),
		() => ({ poll: true })
	);

	useProjectListLive(() => projectsQuery.data?.projects ?? []);

	const isCurrentResultEmpty = $derived(
		!projectsQuery.isPending && (projectsQuery.data?.projects.length ?? 0) === 0
	);

	const hasAnyProjectQuery = createListProjectsQuery(
		() => ({ page: 1, per_page: 1, filter: 'all' }),
		() => ({ enabled: isCurrentResultEmpty })
	);

	const isTrulyEmpty = $derived(isCurrentResultEmpty && hasAnyProjectQuery.data?.meta.total === 0);

	// A few projects all fit on one page. Controls appear once there is something to narrow down,
	// and stay while a search or filter is on, or the way back would be gone.
	const showControls = $derived(
		Boolean(search.trim()) || filter !== 'all' || (projectsQuery.data?.meta.total ?? 0) > perPage
	);

	const pilotLimitsQuery = createPilotLimitsQuery();
</script>

<svelte:head><title>{pageTitle('Proyek')}</title></svelte:head>
<div class="flex flex-col gap-6">
	{#if isTrulyEmpty}
		<CreateProjectHeroCard />
		<PilotQuotaNotice limits={pilotLimitsQuery.data} />
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0 flex-1 basis-64">
				<PilotQuotaNotice limits={pilotLimitsQuery.data} />
			</div>
			<Button href={resolve('/projects/new')}>
				<Plus size={16} weight="bold" aria-hidden="true" />
				Buat proyek
			</Button>
		</div>

		{#if showControls}
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<ProjectFilter bind:value={filter} />
				<SearchInput
					class="w-full sm:w-64"
					placeholder="Cari proyek"
					debounce={300}
					onSearch={(value) => (search = value)}
				/>
			</div>
		{/if}

		<ProjectList
			projects={projectsQuery.data?.projects ?? []}
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
	{/if}
</div>
