<script lang="ts">
	import { page } from '$app/state';
	import AgentDetailPage from '$lib/features/admin/components/pages/AgentDetailPage.svelte';
</script>

{#key page.params.id}
	<AgentDetailPage id={page.params.id ?? ''} />
{/key}
