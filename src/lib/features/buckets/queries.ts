import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getBucket, listBuckets } from '$lib/api/resources/buckets';
import { resolveBucketPollInterval } from './presentation';

/** A workspace's buckets, polled only while the node creates, resizes, or deletes one of them. */
export function createBucketsQuery(
	workspaceId: () => string | null,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.buckets(id ?? ''),
			queryFn: () => listBuckets(id ?? ''),
			enabled: Boolean(id) && (options().enabled ?? true),
			refetchInterval: (query) => resolveBucketPollInterval(query.state.data)
		};
	});
}

export function createBucketQuery(workspaceId: () => string | null, bucketId: () => string) {
	return createQuery(() => {
		const id = workspaceId();
		const bucket = bucketId();
		return {
			queryKey: queryKeys.workspaces.bucket(id ?? '', bucket),
			queryFn: () => getBucket(id ?? '', bucket),
			enabled: Boolean(id) && Boolean(bucket),
			// A bucket that is gone stays gone; asking again only repeats the 404.
			retry: false,
			refetchInterval: (query) =>
				resolveBucketPollInterval(query.state.data ? [query.state.data] : undefined)
		};
	});
}
