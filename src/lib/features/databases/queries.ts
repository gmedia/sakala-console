import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getDatabase, listDatabases } from '$lib/api/resources/databases';
import { listRegions } from '$lib/api/resources/regions';
import { resolveDatabasePollInterval } from './presentation';

/** A workspace's databases, polled only while the node creates or drops one of them. */
export function createDatabasesQuery(
	workspaceId: () => string | null,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = workspaceId();
		return {
			queryKey: queryKeys.workspaces.databases(id ?? ''),
			queryFn: () => listDatabases(id ?? ''),
			enabled: Boolean(id) && (options().enabled ?? true),
			refetchInterval: (query) => resolveDatabasePollInterval(query.state.data)
		};
	});
}

export function createDatabaseQuery(workspaceId: () => string | null, databaseId: () => string) {
	return createQuery(() => {
		const id = workspaceId();
		const database = databaseId();
		return {
			queryKey: queryKeys.workspaces.database(id ?? '', database),
			queryFn: () => getDatabase(id ?? '', database),
			enabled: Boolean(id) && Boolean(database),
			// A database that is gone stays gone; asking again only repeats the 404.
			retry: false,
			refetchInterval: (query) =>
				resolveDatabasePollInterval(query.state.data ? [query.state.data] : undefined)
		};
	});
}

/** The regions rarely change during a visit. */
export function createRegionsQuery(enabled: () => boolean = () => true) {
	return createQuery(() => ({
		queryKey: queryKeys.regions,
		queryFn: listRegions,
		staleTime: 5 * 60_000,
		enabled: enabled()
	}));
}
