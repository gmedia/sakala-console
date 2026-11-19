import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './client';

vi.mock('./csrf', () => ({ ensureCsrfCookie: vi.fn(), readXsrfToken: () => 'token-from-cookie' }));

afterEach(() => vi.unstubAllGlobals());

describe('apiRequest with anonymous', () => {
	it('sends no cookies and no CSRF header, and keeps the query string byte for byte', async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ data: { category: 'project_issue', email: false } }), {
				status: 200
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const { ensureCsrfCookie } = await import('./csrf');
		const search = '?category=project_issue&user=7&signature=ab%2Fcd%3D';

		await apiRequest(`api/v1/public/notifications/unsubscribe${search}`, {
			method: 'POST',
			anonymous: true
		});

		const [url, init] = fetchMock.mock.calls[0];
		expect((url as URL).search).toBe(search);
		expect(init.credentials).toBe('omit');
		expect((init.headers as Headers).has('X-XSRF-TOKEN')).toBe(false);
		expect(ensureCsrfCookie).not.toHaveBeenCalled();
	});
});
