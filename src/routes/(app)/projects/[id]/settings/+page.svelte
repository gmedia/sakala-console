<script lang="ts">
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/stores';
	import ProjectSettingsTab from '$lib/features/projects/components/detail/ProjectSettingsTab.svelte';

	let projectId = $derived($page.params.id as string);
	const projectQuery = createProjectQuery(() => projectId);
</script>

<svelte:head><title>{pageTitle('Pengaturan', projectQuery.data?.name)}</title></svelte:head>

<ProjectSettingsTab {projectId} />
