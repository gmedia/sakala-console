import { describe, expect, it, vi } from 'vitest';
import { submitFeedback } from './feedback';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

describe('feedback resource', () => {
	it('posts the form and reads the created record', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce({
			data: { id: 'f-1', category: 'bug', created_at: '2026-11-06T00:00:00Z' }
		});

		const created = await submitFeedback({
			category: 'bug',
			message: 'Tombol deploy tidak merespons.',
			consent: false
		});

		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/feedback', {
			method: 'POST',
			json: { category: 'bug', message: 'Tombol deploy tidak merespons.', consent: false }
		});
		expect(created.id).toBe('f-1');
	});

	it('refuses a response that is not a created record', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce({ data: {} });

		await expect(
			submitFeedback({ category: 'bug', message: 'Masukan', consent: false })
		).rejects.toThrow();
	});
});
