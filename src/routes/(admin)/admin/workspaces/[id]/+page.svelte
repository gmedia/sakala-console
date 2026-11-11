<script lang="ts">
	import { page } from '$app/state';
	import WorkspaceDetailPage from '$lib/features/admin/components/pages/WorkspaceDetailPage.svelte';
</script>

{#key page.params.id}
	<WorkspaceDetailPage id={page.params.id ?? ''} />
{/key}
