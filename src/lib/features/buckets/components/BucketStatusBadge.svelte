<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { Bucket } from '$lib/api/resources/buckets';
	import { bucketStatusView, FULL_COPY, isBucketFull, isOnNode } from '../presentation';

	type Props = {
		bucket: Pick<Bucket, 'status' | 'last_failure'> &
			Partial<Pick<Bucket, 'size_bytes' | 'quota_mb'>>;
	};

	let { bucket }: Props = $props();

	const view = $derived(bucketStatusView(bucket));
	// "Penuh" is derived from the last usage report: the node refuses uploads past the quota.
	const full = $derived(
		isOnNode(bucket) &&
			bucket.size_bytes !== undefined &&
			bucket.quota_mb !== undefined &&
			isBucketFull({ size_bytes: bucket.size_bytes, quota_mb: bucket.quota_mb })
	);
</script>

<span class="inline-flex flex-wrap items-center gap-1.5">
	<Badge tone={view.tone}>
		{#if view.transitional}
			<span class="sr-only">Sedang berjalan:</span>
		{/if}
		{view.label}
	</Badge>
	{#if full}
		<Badge tone="error">{FULL_COPY.label}</Badge>
	{/if}
</span>
