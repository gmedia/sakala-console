import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorFromResponse, NetworkError } from './errors';
import {
	clearSessionCache,
	queryClient,
	reportApiError,
	setSessionExpiredHandler,
	setWorkspaceAccessHandler
} from './query-client';
import { queryKeys } from './query-keys';

const handler = vi.fn();

afterEach(() => {
	handler.mockReset();
	setSessionExpiredHandler(null);
	setWorkspaceAccessHandler(null);
	queryClient.clear();
});

describe('session expiry on API errors', () => {
	it('fires on a 401 from any query, without retrying it', async () => {
		setSessionExpiredHandler(handler);
		const queryFn = vi.fn().mockRejectedValue(apiErrorFromResponse(401));

		await queryClient.fetchQuery({ queryKey: ['any'], queryFn }).catch(() => {});

		expect(handler).toHaveBeenCalledTimes(1);
		expect(queryFn).toHaveBeenCalledTimes(1);
	});

	it('fires on a 401 from any mutation', async () => {
		setSessionExpiredHandler(handler);
		const mutation = queryClient.getMutationCache().build(queryClient, {
			mutationFn: () => Promise.reject(apiErrorFromResponse(401))
		});

		await mutation.execute(undefined).catch(() => {});

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('leaves a mutation alone when its 401 means something else, like a wrong password', async () => {
		setSessionExpiredHandler(handler);
		const mutation = queryClient.getMutationCache().build(queryClient, {
			meta: { handlesUnauthenticated: true },
			mutationFn: () => Promise.reject(apiErrorFromResponse(401))
		});

		await mutation.execute(undefined).catch(() => {});

		expect(handler).not.toHaveBeenCalled();
	});

	it.each([
		['403', apiErrorFromResponse(403)],
		['419', apiErrorFromResponse(419)],
		['422', apiErrorFromResponse(422)],
		['500', apiErrorFromResponse(500)],
		['network', new NetworkError()],
		['a parse error', new TypeError('bad shape')]
	])('does nothing on %s', (_name, error) => {
		setSessionExpiredHandler(handler);

		reportApiError(error);

		expect(handler).not.toHaveBeenCalled();
	});
});

describe('a refusal because the terms are not accepted', () => {
	it('re-reads the user, which brings up the acceptance screen, and keeps the session', () => {
		const handler = vi.fn();
		setSessionExpiredHandler(handler);
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

		reportApiError(apiErrorFromResponse(403, { code: 'LEGAL_ACCEPTANCE_REQUIRED' }));

		expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.auth.currentUser });
		expect(handler).not.toHaveBeenCalled();
		invalidate.mockRestore();
	});
});

describe('a read about a workspace the user may have lost', () => {
	it.each([403, 404, 422])('hands the workspace to the handler on a %i', async (status) => {
		setWorkspaceAccessHandler(handler);

		await queryClient
			.fetchQuery({
				queryKey: queryKeys.workspaces.members('w1'),
				queryFn: () => Promise.reject(apiErrorFromResponse(status)),
				retry: false
			})
			.catch(() => {});

		expect(handler).toHaveBeenCalledExactlyOnceWith('w1');
	});

	it('hands over the workspace of a limits read and of a filtered project list', async () => {
		setWorkspaceAccessHandler(handler);
		for (const queryKey of [
			queryKeys.workspaces.limits('w2'),
			queryKeys.projects.list({ page: 1, workspace_id: 'w3' })
		]) {
			await queryClient
				.fetchQuery({
					queryKey,
					queryFn: () => Promise.reject(apiErrorFromResponse(403)),
					retry: false
				})
				.catch(() => {});
		}

		expect(handler.mock.calls).toEqual([['w2'], ['w3']]);
	});

	it.each([
		['a 500 on a workspace read', queryKeys.workspaces.members('w1'), apiErrorFromResponse(500)],
		['a network error', queryKeys.workspaces.members('w1'), new NetworkError()],
		['a 403 on a read that spans workspaces', queryKeys.workspaces.list, apiErrorFromResponse(403)],
		['a 403 on personal limits', queryKeys.workspaces.limits(null), apiErrorFromResponse(403)]
	])('stays out of %s', async (_name, queryKey, error) => {
		setWorkspaceAccessHandler(handler);

		await queryClient
			.fetchQuery({ queryKey, queryFn: () => Promise.reject(error), retry: false })
			.catch(() => {});

		expect(handler).not.toHaveBeenCalled();
	});
});

describe('clearSessionCache', () => {
	it('forgets session data but keeps the public auth options a page may be waiting on', () => {
		const options = {
			email_delivery_enabled: true,
			providers: { github: true, google: false },
			legal: {
				terms_version: 'syarat-v1',
				acceptable_use_version: 'penggunaan-wajar-v1',
				privacy_notice_version: 'privasi-v1'
			}
		};
		queryClient.setQueryData(queryKeys.auth.currentUser, { id: 1 });
		queryClient.setQueryData(['projects', 'list'], []);
		queryClient.setQueryData(queryKeys.auth.options, options);

		clearSessionCache();

		expect(queryClient.getQueryData(queryKeys.auth.currentUser)).toBeUndefined();
		expect(queryClient.getQueryData(['projects', 'list'])).toBeUndefined();
		expect(queryClient.getQueryData(queryKeys.auth.options)).toEqual(options);
	});

	it('forgets finished mutations too', async () => {
		const mutation = queryClient.getMutationCache().build(queryClient, {
			mutationFn: () => Promise.resolve('selesai')
		});
		await mutation.execute(undefined);

		clearSessionCache();

		expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
	});
});
