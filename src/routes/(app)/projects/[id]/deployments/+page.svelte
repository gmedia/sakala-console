<script lang="ts">
	import { page } from '$app/stores';
	import DeploymentsTab from '$lib/features/projects/components/detail/DeploymentsTab.svelte';

	let projectId = $derived($page.params.id as string);
</script>

<svelte:head><title>Deployments | Sakala Console</title></svelte:head>

<DeploymentsTab {projectId} />
