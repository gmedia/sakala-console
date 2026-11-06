import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorFromResponse, NetworkError } from './errors';
import {
	clearSessionCache,
	queryClient,
	reportApiError,
	setSessionExpiredHandler
} from './query-client';
import { queryKeys } from './query-keys';

const handler = vi.fn();

afterEach(() => {
	handler.mockReset();
	setSessionExpiredHandler(null);
	queryClient.clear();
});

describe('session expiry on API errors (U-30)', () => {
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

describe('clearSessionCache', () => {
	it('forgets session data but keeps the public auth options a page may be waiting on', () => {
		const options = { email_delivery_enabled: true, providers: { github: true, google: false } };
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
