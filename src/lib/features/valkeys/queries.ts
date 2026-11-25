import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getValkey, listValkeys } from '$lib/api/resources/valkeys';
import { resolveValkeyPollInterval } from './presentation';

/** A workspace's stores, polled only while the node creates, resizes, or deletes one of them. */
export function createValkeysQuery(
	workspaceId: () => string | null,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.valkeys(id ?? ''),
			queryFn: () => listValkeys(id ?? ''),
			enabled: Boolean(id) && (options().enabled ?? true),
			refetchInterval: (query) => resolveValkeyPollInterval(query.state.data)
		};
	});
}

export function createValkeyQuery(
	workspaceId: () => string | null,
	valkeyId: () => string,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = workspaceId();
		const valkey = valkeyId();
		return {
			queryKey: queryKeys.workspaces.valkey(id ?? '', valkey),
			queryFn: () => getValkey(id ?? '', valkey),
			enabled: Boolean(id) && Boolean(valkey) && (options().enabled ?? true),
			// A store that is gone stays gone; asking again only repeats the 404.
			retry: false,
			refetchInterval: (query) =>
				resolveValkeyPollInterval(query.state.data ? [query.state.data] : undefined)
		};
	});
}
