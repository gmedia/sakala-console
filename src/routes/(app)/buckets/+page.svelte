<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import BucketsPage from '$lib/features/buckets/components/BucketsPage.svelte';
</script>

<svelte:head><title>{pageTitle('Bucket')}</title></svelte:head>

<BucketsPage />
