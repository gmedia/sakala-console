import { vi, describe, it, expect, beforeEach } from 'vitest';
import { authorizeChannel } from './broadcasting';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

vi.mock('$lib/config/public', () => ({
	publicConfig: {
		apiUrl: 'http://api.sakala.test:8000/api/v1'
	}
}));

const mockedApiRequest = vi.mocked(apiRequest);

const EXPECTED_URL = 'http://api.sakala.test:8000/broadcasting/auth';

describe('authorizeChannel', () => {
	beforeEach(() => {
		mockedApiRequest.mockReset();
	});

	it('mengirim POST ke URL absolut /broadcasting/auth dengan socket_id dan channel_name', async () => {
		mockedApiRequest.mockResolvedValue({ auth: 'signed-auth-string' });

		await authorizeChannel('private-deployment.1', 'socket-213');

		expect(mockedApiRequest).toHaveBeenCalledWith(EXPECTED_URL, {
			method: 'POST',
			json: { socket_id: 'socket-213', channel_name: 'private-deployment.1' }
		});
	});

	it('tidak menyertakan prefix /api/v1 di URL', async () => {
		mockedApiRequest.mockResolvedValue({ auth: 'x' });

		await authorizeChannel('private-deployment.1', 'socket-213');

		const [url] = mockedApiRequest.mock.calls[0];
		expect(url).not.toContain('/api/v1/broadcasting');
		expect(url).toBe(EXPECTED_URL);
	});

	it('mengembalikan ChannelAuthorization ketika response valid (dengan channel_data)', async () => {
		mockedApiRequest.mockResolvedValue({
			auth: 'signed-auth-string',
			channel_data: '{"user_id":1}'
		});

		const result = await authorizeChannel('private-deployment.1', 'socket-abc');

		expect(result).toEqual({
			auth: 'signed-auth-string',
			channel_data: '{"user_id":1}'
		});
	});

	it('melempar error ketika response tidak valid (field auth hilang)', async () => {
		mockedApiRequest.mockResolvedValue({ channel_data: 'x' });

		await expect(authorizeChannel('private-deployment.1', 'socket-abc')).rejects.toThrow();
	});

	it('meneruskan error dari apiRequest (misal 403 forbidden)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('403 Forbidden'));

		await expect(authorizeChannel('private-deployment.1', 'socket-abc')).rejects.toThrow(
			'403 Forbidden'
		);
	});
});
