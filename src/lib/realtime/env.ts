import { z } from 'zod';
import {
	PUBLIC_REVERB_HOST,
	PUBLIC_REVERB_KEY,
	PUBLIC_REVERB_PORT,
	PUBLIC_REVERB_SCHEME
} from '$env/static/public';

const realtimeEnvSchema = z.object({
	host: z.string().min(1),
	key: z.string().min(1),
	port: z.coerce.number().int().positive(),
	scheme: z.enum(['http', 'https'])
});

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function getRealtimeEnv(): RealtimeEnv | null {
	const result = realtimeEnvSchema.safeParse({
		host: PUBLIC_REVERB_HOST,
		key: PUBLIC_REVERB_KEY,
		port: PUBLIC_REVERB_PORT,
		scheme: PUBLIC_REVERB_SCHEME
	});

	return result.success ? result.data : null;
}
