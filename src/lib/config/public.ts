import { env } from '$env/dynamic/public';
import { z } from 'zod';
import { isHttpUrl, withRuntimeConfig } from './runtime';

// Zod otherwise probes for `new Function` to speed up parsing, and the image's CSP reports that.
z.config({ jitless: true });

// `z.url()` alone accepts any scheme, including `javascript:`, so the console only talks to web origins.
const httpUrl = z.url().refine(isHttpUrl, 'Must be an http or https URL.');

const publicConfigSchema = z.object({
	appUrl: httpUrl,
	apiUrl: httpUrl
});

// Settings the container renders at start (see ./runtime.ts) win over the values baked in at build.
const resolved = withRuntimeConfig({
	PUBLIC_APP_URL: env.PUBLIC_APP_URL,
	PUBLIC_API_URL: env.PUBLIC_API_URL
});

export const publicConfig = publicConfigSchema.parse({
	appUrl: resolved.PUBLIC_APP_URL || 'http://app.sakala.localhost:5173',
	apiUrl: resolved.PUBLIC_API_URL || 'http://api.sakala.localhost:8000'
});
