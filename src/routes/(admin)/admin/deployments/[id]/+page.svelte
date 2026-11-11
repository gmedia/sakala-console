<script lang="ts">
	import { page } from '$app/state';
	import DeploymentDetailPage from '$lib/features/admin/components/pages/DeploymentDetailPage.svelte';
</script>

{#key page.params.id}
	<DeploymentDetailPage id={page.params.id ?? ''} />
{/key}
