<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import DatabasesPage from '$lib/features/databases/components/DatabasesPage.svelte';
</script>

<svelte:head><title>{pageTitle('Database')}</title></svelte:head>

<DatabasesPage />
