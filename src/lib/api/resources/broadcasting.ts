import { z } from 'zod';
import { apiRequest } from '../client';

const channelAuthorization = z.object({
	auth: z.string(),
	channel_data: z.string().optional()
});

export type ChannelAuthorization = z.infer<typeof channelAuthorization>;

export async function authorizeChannel(
	channelName: string,
	socketId: string
): Promise<ChannelAuthorization> {
	const response = await apiRequest<unknown>('broadcasting/auth', {
		method: 'POST',
		json: { socket_id: socketId, channel_name: channelName }
	});

	return channelAuthorization.parse(response);
}
