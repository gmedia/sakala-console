<script lang="ts">
	import { page } from '$app/state';
	import { pageTitle } from '$lib/utils/page-title';
	import DatabaseDetail from '$lib/features/databases/components/DatabaseDetail.svelte';
	import { useDatabaseRoute } from '$lib/features/databases/route-state.svelte';

	const route = useDatabaseRoute();
	const databaseId = $derived(page.params.databaseId ?? '');
</script>

<svelte:head>
	<title>{pageTitle(route.name ? `Database ${route.name}` : 'Database')}</title>
</svelte:head>

{#key `${route.workspaceId}:${databaseId}`}
	<DatabaseDetail workspaceId={route.workspaceId} {databaseId} />
{/key}
