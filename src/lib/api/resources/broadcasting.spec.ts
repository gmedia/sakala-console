import { vi, describe, it, expect, beforeEach } from 'vitest';
import { authorizeChannel } from './broadcasting';
import { apiRequest } from '../client';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

const mockedApiRequest = vi.mocked(apiRequest);

describe('authorizeChannel', () => {
	beforeEach(() => {
		mockedApiRequest.mockReset();
	});

	it('send POST to broadcasting/auth with socket_id and channel_name', async () => {
		mockedApiRequest.mockResolvedValue({ auth: 'signed-auth-string' });

		await authorizeChannel('private-deployment.1', 'socket-213');

		expect(mockedApiRequest).toHaveBeenCalledWith('broadcasting/auth', {
			method: 'POST',
			json: { socket_id: 'socket-213', channel_name: 'private-deployment.1' }
		});
	});

	it('returns ChannelAuthorization when response valid (with channel_data)', async () => {
		mockedApiRequest.mockResolvedValue({
			auth: 'signed-auth-string',
			channel_data: '{"user_id":1}'
		});

		const result = await authorizeChannel('private-deployment.1', 'socket-abc');

		expect(result).toEqual({ auth: 'signed-auth-string', channel_data: '{"user_id":1}' });
	});

	it('throw when response is invalid (field auth missing)', async () => {
		mockedApiRequest.mockResolvedValue({ channel_data: 'x' });

		await expect(authorizeChannel('private-deployment.1', 'socket-abc')).rejects.toThrow();
	});

	it('passes through errors from apiRequest (e.g., 403 forbidden)', async () => {
		mockedApiRequest.mockRejectedValue(new Error('403 Forbidden'));

		await expect(authorizeChannel('private-deployment.1', 'socket-abc')).rejects.toThrow(
			'403 Forbidden'
		);
	});
});
