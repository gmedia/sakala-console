import { z } from 'zod';
import { env } from '$env/dynamic/public';

const realtimeEnvSchema = z.object({
	host: z.string().min(1),
	key: z.string().min(1),
	port: z.coerce.number().int().positive(),
	scheme: z.enum(['http', 'https'])
});

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function getRealtimeEnv(): RealtimeEnv | null {
	const result = realtimeEnvSchema.safeParse({
		host: env.PUBLIC_REVERB_HOST,
		key: env.PUBLIC_REVERB_KEY,
		port: env.PUBLIC_REVERB_PORT,
		scheme: env.PUBLIC_REVERB_SCHEME
	});

	return result.success ? result.data : null;
}
