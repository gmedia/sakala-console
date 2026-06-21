import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getServiceStatus } from '$lib/api/resources/system';

export function createServiceStatusQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.system.status,
		queryFn: getServiceStatus
	}));
}
