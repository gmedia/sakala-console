<script lang="ts">
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/stores';
	import EnvironmentVariablesTab from '$lib/features/projects/components/detail/EnvironmentVariablesTab.svelte';

	let projectId = $derived($page.params.id as string);
	const projectQuery = createProjectQuery(() => projectId);
</script>

<svelte:head><title>{pageTitle('Variabel', projectQuery.data?.name)}</title></svelte:head>

<div class="mt-4">
	<EnvironmentVariablesTab {projectId} />
</div>
