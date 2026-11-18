<script lang="ts">
	import { page } from '$app/stores';
	import { pageTitle } from '$lib/utils/page-title';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectOverview from '$lib/features/projects/components/overview/ProjectOverview.svelte';
	import { PROJECT_TAB_LABELS } from '$lib/features/projects/overview/tabs';

	let projectId = $derived($page.params.id as string);
	const projectQuery = createProjectQuery(() => projectId);
</script>

<svelte:head
	><title>{pageTitle(PROJECT_TAB_LABELS.overview, projectQuery.data?.name)}</title></svelte:head
>

<ProjectOverview {projectId} />
