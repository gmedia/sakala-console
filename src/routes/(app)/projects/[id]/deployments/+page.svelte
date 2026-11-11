<script lang="ts">
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/stores';
	import DeploymentsTab from '$lib/features/projects/components/detail/DeploymentsTab.svelte';

	let projectId = $derived($page.params.id as string);
	const projectQuery = createProjectQuery(() => projectId);
</script>

<svelte:head><title>{pageTitle('Riwayat', projectQuery.data?.name)}</title></svelte:head>

<DeploymentsTab {projectId} />
