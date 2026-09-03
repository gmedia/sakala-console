import { vi, describe, it, expect } from 'vitest';

const realtimeState = { status: 'idle' };
describe('realtime failure does not break the fetch API', () => {
	it('getEcho() fails completely without throwing an exception, while other unrelated operations still resolve.', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: true }));
		vi.doMock('./env', () => ({
			getRealtimeEnv: () => {
				throw new Error('Simulated failure in getRealtimeEnv');
			}
		}));
		vi.doMock('./connection-state.svelte', () => ({
			bindConnectionState: vi.fn(),
			resetConnectionState: vi.fn(),
			realtimeState
		}));
		vi.doMock('$lib/api/resources/broadcasting', () => ({
			authorizeChannel: vi.fn()
		}));

		const { getEcho } = await import('./echo');
		const unrelatedOperation = Promise.resolve('data from endpoint REST API');

		const [echoResult, otherResult] = await Promise.all([getEcho(), unrelatedOperation]);

		expect(echoResult).toBeNull();
		expect(otherResult).toBe('data from endpoint REST API');
	});

	it('apiRequest() still works even if getEcho() called and realtime non-active', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: true }));
		vi.doMock('./env', () => ({ getRealtimeEnv: () => null }));
		vi.doMock('./connection-state.svelte', () => ({
			bindConnectionState: vi.fn(),
			resetConnectionState: vi.fn(),
			realtimeState
		}));
		vi.doMock('$lib/api/csrf', () => ({
			ensureCsrfCookie: vi.fn().mockResolvedValue(undefined),
			readXsrfToken: vi.fn().mockReturnValue(undefined)
		}));

		const { getEcho } = await import('./echo');
		const { apiRequest } = await import('$lib/api/client');

		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }));

		const [echoResult, apiResult] = await Promise.all([getEcho(), apiRequest('some/endpoint')]);

		expect(echoResult).toBeNull();
		expect(apiResult).toEqual({ data: 'ok' });
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		fetchSpy.mockRestore();
	});
});
