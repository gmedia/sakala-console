<script lang="ts">
	import { page } from '$app/state';
	import { pageTitle } from '$lib/utils/page-title';
	import ValkeyDetail from '$lib/features/valkeys/components/ValkeyDetail.svelte';
	import { useValkeyRoute } from '$lib/features/valkeys/route-state.svelte';

	const route = useValkeyRoute();
	const valkeyId = $derived(page.params.valkeyId ?? '');
</script>

<svelte:head>
	<title>{pageTitle(route.name ? `Valkey ${route.name}` : 'Valkey')}</title>
</svelte:head>

{#key `${route.workspaceId}:${valkeyId}`}
	<ValkeyDetail workspaceId={route.workspaceId} {valkeyId} />
{/key}
