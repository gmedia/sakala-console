import { browser } from '$app/environment';
import { publicConfig } from '$lib/config/public';
import { NetworkError } from './errors';

let csrfRequest: Promise<void> | undefined;

export function readXsrfToken(): string | undefined {
	if (!browser) return undefined;

	const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));

	return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : undefined;
}

export async function ensureCsrfCookie(): Promise<void> {
	if (!browser) return;
	if (readXsrfToken()) return;

	csrfRequest ??= requestCsrfCookie().catch((error: unknown) => {
		csrfRequest = undefined;
		throw error;
	});

	await csrfRequest;
}

async function requestCsrfCookie(): Promise<void> {
	try {
		const response = await fetch(new URL('/sanctum/csrf-cookie', publicConfig.apiUrl), {
			credentials: 'include',
			headers: { Accept: 'application/json' }
		});

		if (!response.ok) {
			throw new NetworkError('Cookie keamanan Sakala tidak dapat disiapkan.');
		}
	} catch (error) {
		if (error instanceof NetworkError) throw error;
		throw new NetworkError('Sakala API tidak dapat dijangkau untuk menyiapkan sesi.', error);
	}
}
