import { env } from '$env/dynamic/public';
import { z } from 'zod';

const publicConfigSchema = z.object({
	appUrl: z.url(),
	apiUrl: z.url()
});

export const publicConfig = publicConfigSchema.parse({
	appUrl: env.PUBLIC_APP_URL || 'http://app.sakala.localhost:5173',
	apiUrl: env.PUBLIC_API_URL || 'http://api.sakala.localhost:8000'
});
