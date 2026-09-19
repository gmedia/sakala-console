<script lang="ts">
	import { page } from '$app/stores';
	import ProjectSettingsTab from '$lib/features/projects/components/detail/ProjectSettingsTab.svelte';

	let projectId = $derived($page.params.id as string);
</script>

<svelte:head><title>Settings | Sakala Console</title></svelte:head>

<ProjectSettingsTab {projectId} />
