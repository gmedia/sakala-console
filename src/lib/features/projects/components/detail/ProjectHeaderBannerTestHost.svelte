<script lang="ts">
	import { initProjectDetailContext } from '$lib/features/projects/detail/projectDetailState.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectHeaderBanner from './ProjectHeaderBanner.svelte';

	let { projectId }: { projectId: string } = $props();

	// What the project layout provides around the banner.
	initProjectDetailContext();
	const projectQuery = createProjectQuery(() => projectId);
</script>

{#if projectQuery.data}
	<ProjectHeaderBanner project={projectQuery.data} />
{/if}
