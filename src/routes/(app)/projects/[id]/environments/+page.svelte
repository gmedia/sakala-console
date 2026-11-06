<script lang="ts">
	import { page } from '$app/stores';
	import EnvironmentVariablesTab from '$lib/features/projects/components/detail/EnvironmentVariablesTab.svelte';

	let projectId = $derived($page.params.id as string);
</script>

<svelte:head><title>Environment Variables | Sakala Console</title></svelte:head>

<div class="mt-4">
	<EnvironmentVariablesTab {projectId} />
</div>
