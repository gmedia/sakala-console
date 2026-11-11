<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import Plus from 'phosphor-svelte/lib/Plus';
	import { resolve } from '$app/paths';
	import SquaresFour from 'phosphor-svelte/lib/SquaresFour';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import CreateProjectHeroCard from '$lib/features/projects/components/create/CreateProjectHeroCard.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import ProjectList from '$lib/features/projects/components/project/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/project/ProjectFilter.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';
	import PilotQuotaNotice from '$lib/features/projects/components/create/PilotQuotaNotice.svelte';
	import { createListProjectsQuery } from '$lib/features/projects/queries';
	import { useProjectListLive } from '$lib/features/projects/use-project-list-live.svelte';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import { canManageProjects, limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';

	const perPage = 6;

	// The list shows the active workspace. If the workspaces cannot be read, it shows every project
	// the user can open, which is what the API returns without a workspace.
	const workspaces = useActiveWorkspace();
	const active = $derived(workspaces.active);
	const workspaceParam = $derived(workspaces.isError || !active ? {} : { workspace_id: active.id });
	const teamName = $derived(active?.type === 'team' ? active.name : undefined);
	const canCreate = $derived(!active || canManageProjects(active.role));

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
			filter,
			...workspaceParam
		}),
		() => ({ poll: true, enabled: workspaces.isSettled })
	);

	useProjectListLive(() => projectsQuery.data?.projects ?? []);

	const isCurrentResultEmpty = $derived(
		!projectsQuery.isPending && (projectsQuery.data?.projects.length ?? 0) === 0
	);

	const hasAnyProjectQuery = createListProjectsQuery(
		() => ({ page: 1, per_page: 1, filter: 'all', ...workspaceParam }),
		() => ({ enabled: isCurrentResultEmpty && workspaces.isSettled })
	);

	const isTrulyEmpty = $derived(isCurrentResultEmpty && hasAnyProjectQuery.data?.meta.total === 0);

	// A few projects all fit on one page. Controls appear once there is something to narrow down,
	// and stay while a search or filter is on, or the way back would be gone.
	const showControls = $derived(
		Boolean(search.trim()) || filter !== 'all' || (projectsQuery.data?.meta.total ?? 0) > perPage
	);

	const pilotLimitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(active),
		() => ({ enabled: workspaces.isSettled })
	);
</script>

{#snippet viewerNote()}
	<p class="text-sm text-muted" data-testid="viewer-create-note">
		Kamu pengamat di {active?.name}, jadi bisa melihat proyeknya tetapi tidak bisa membuat proyek
		baru.
	</p>
{/snippet}

<svelte:head><title>{pageTitle('Proyek')}</title></svelte:head>
<div class="flex flex-col gap-6">
	{#if isTrulyEmpty && !canCreate}
		<EmptyState
			icon={SquaresFour}
			tone="muted"
			title={`Belum ada proyek di ${active?.name ?? 'workspace ini'}`}
			description="Proyek yang dibuat pemilik atau anggota workspace ini akan muncul di sini."
		/>
		{@render viewerNote()}
	{:else if isTrulyEmpty}
		<CreateProjectHeroCard workspaceName={teamName} />
		<PilotQuotaNotice limits={pilotLimitsQuery.data} workspaceName={teamName} />
	{:else}
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="min-w-0 flex-1 basis-64">
				{#if canCreate}
					<PilotQuotaNotice limits={pilotLimitsQuery.data} workspaceName={teamName} />
				{:else}
					{@render viewerNote()}
				{/if}
			</div>
			{#if canCreate}
				<Button href={resolve('/projects/new')}>
					<Plus size={16} weight="bold" aria-hidden="true" />
					Buat proyek
				</Button>
			{/if}
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
			showWorkspace={workspaces.hasTeams}
			isFetching={projectsQuery.isFetching}
			isError={projectsQuery.error}
			onRetry={() => {
				projectsQuery.refetch();
			}}
			onPageChange={(page) => (currentPage = page)}
		/>
	{/if}
</div>
