<script lang="ts">
	import { page } from '$app/state';
	import { pageTitle } from '$lib/utils/page-title';
	import { createWorkspacesQuery } from '$lib/features/workspaces/queries';
	import WorkspacePage from '$lib/features/workspaces/components/WorkspacePage.svelte';

	const workspaceId = $derived(page.params.workspaceId ?? '');
	const workspacesQuery = createWorkspacesQuery();
	const name = $derived(workspacesQuery.data?.find((item) => item.id === workspaceId)?.name);
</script>

<svelte:head><title>{pageTitle(name ? `Workspace ${name}` : 'Workspace')}</title></svelte:head>

{#key workspaceId}
	<WorkspacePage {workspaceId} />
{/key}
