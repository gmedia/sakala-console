<script lang="ts">
	import { page } from '$app/state';
	import { pageTitle } from '$lib/utils/page-title';
	import BucketDetail from '$lib/features/buckets/components/BucketDetail.svelte';
	import { useBucketRoute } from '$lib/features/buckets/route-state.svelte';

	const route = useBucketRoute();
	const bucketId = $derived(page.params.bucketId ?? '');
</script>

<svelte:head>
	<title>{pageTitle(route.name ? `Bucket ${route.name}` : 'Bucket')}</title>
</svelte:head>

{#key `${route.workspaceId}:${bucketId}`}
	<BucketDetail workspaceId={route.workspaceId} {bucketId} />
{/key}
