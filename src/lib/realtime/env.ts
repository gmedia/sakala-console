import { z } from 'zod';
import {
	PUBLIC_REVERB_HOST,
	PUBLIC_REVERB_KEY,
	PUBLIC_REVERB_PORT,
	PUBLIC_REVERB_SCHEME
} from '$env/static/public';
import { withRuntimeConfig } from '$lib/config/runtime';

const realtimeEnvSchema = z.object({
	host: z.string().min(1),
	key: z.string().min(1),
	port: z.coerce.number().int().positive(),
	scheme: z.enum(['http', 'https'])
});

export type RealtimeEnv = z.infer<typeof realtimeEnvSchema>;

export function getRealtimeEnv(): RealtimeEnv | null {
	// Settings the container renders at start (see $lib/config/runtime) win over build-time values.
	const env = withRuntimeConfig({
		PUBLIC_REVERB_HOST,
		PUBLIC_REVERB_KEY,
		PUBLIC_REVERB_PORT,
		PUBLIC_REVERB_SCHEME
	});
	const result = realtimeEnvSchema.safeParse({
		host: env.PUBLIC_REVERB_HOST,
		key: env.PUBLIC_REVERB_KEY,
		port: env.PUBLIC_REVERB_PORT,
		scheme: env.PUBLIC_REVERB_SCHEME
	});

	return result.success ? result.data : null;
}
