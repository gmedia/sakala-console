<script lang="ts">
	import { page } from '$app/state';
	import ProjectDetailPage from '$lib/features/admin/components/pages/ProjectDetailPage.svelte';
</script>

{#key page.params.id}
	<ProjectDetailPage id={page.params.id ?? ''} />
{/key}
