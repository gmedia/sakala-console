import { afterEach, describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { forgetDeletedProject } from './mutations';
import { projectKeys } from './queries';

const DELETED = 'p-deleted';
const OTHER = 'p-other';

describe('forgetDeletedProject', () => {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

	afterEach(() => client.clear());

	it('cancels and drops everything under the deleted project, and keeps other projects', async () => {
		client.setQueryData(projectKeys.detail(DELETED), { id: DELETED });
		client.setQueryData(projectKeys.deployments(DELETED, { page: 1 }), { data: [] });
		client.setQueryData(projectKeys.environmentVariables(DELETED), []);
		client.setQueryData(queryKeys.deployments.detail(DELETED, 'd-1'), { id: 'd-1' });
		client.setQueryData(queryKeys.deployments.events(DELETED, 'd-1'), { data: [] });
		client.setQueryData(projectKeys.detail(OTHER), { id: OTHER });
		client.setQueryData(queryKeys.deployments.detail(OTHER, 'd-2'), { id: 'd-2' });

		// A read already on its way when the 204 lands must not resolve into the cache.
		let signal: AbortSignal | undefined;
		const inFlight = client.fetchQuery({
			queryKey: projectKeys.deployments(DELETED),
			queryFn: (context) => {
				signal = context.signal;
				return new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 1_000));
			}
		});

		await forgetDeletedProject(client, DELETED);

		expect(signal?.aborted).toBe(true);
		await expect(inFlight).rejects.toThrow();

		const remaining = client
			.getQueryCache()
			.getAll()
			.map((query) => query.queryKey);
		expect(remaining).toEqual([
			projectKeys.detail(OTHER),
			queryKeys.deployments.detail(OTHER, 'd-2')
		]);
	});

	it('marks the project lists and the limits stale so they show the project is gone', async () => {
		client.setQueryData(queryKeys.projects.list({ page: 1 }), { data: [] });
		client.setQueryData(queryKeys.pilotLimits, {});

		await forgetDeletedProject(client, DELETED);

		expect(client.getQueryState(queryKeys.projects.list({ page: 1 }))?.isInvalidated).toBe(true);
		expect(client.getQueryState(queryKeys.pilotLimits)?.isInvalidated).toBe(true);
	});
});
