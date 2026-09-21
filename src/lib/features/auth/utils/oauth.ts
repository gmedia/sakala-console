import { env } from '$env/dynamic/public';

const apiUrl = env.PUBLIC_API_URL;

export function isValidInternalPath(path: string | null | undefined): boolean {
	if (!path || typeof path !== 'string') return false;

	let decoded: string;
	try {
		decoded = decodeURIComponent(path);
	} catch {
		return false;
	}

	if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) {
		return false;
	}

	try {
		const dummyOrigin = 'http://sakala-internal.local';
		const parsed = new URL(path, dummyOrigin);
		return (
			parsed.origin === dummyOrigin &&
			parsed.pathname.startsWith('/') &&
			!parsed.pathname.startsWith('//')
		);
	} catch {
		return false;
	}
}

export type AuthProviderId = 'github' | 'google' | 'email';

const LAST_LOGIN_PROVIDER_KEY = 'last_login_provider';

export function getLastLoginProvider(): AuthProviderId | null {
	if (typeof window === 'undefined') return null;
	const val = localStorage.getItem(LAST_LOGIN_PROVIDER_KEY);
	if (val === 'github' || val === 'google' || val === 'email') {
		return val;
	}
	return null;
}

export function setLastLoginProvider(provider: AuthProviderId): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(LAST_LOGIN_PROVIDER_KEY, provider);
}

export function redirectToGithubAuth(returnUrl?: string | null) {
	const url = new URL(`${apiUrl}/auth/github/redirect`);

	if (isValidInternalPath(returnUrl)) {
		url.searchParams.append('return_url', returnUrl as string);
		localStorage.setItem('return_url', returnUrl as string);
	} else {
		localStorage.removeItem('return_url');
	}

	setLastLoginProvider('github');
	window.location.href = url.toString();
}

export function redirectToGoogleAuth(returnUrl?: string | null) {
	const url = new URL(`${apiUrl}/auth/google/redirect`);

	if (isValidInternalPath(returnUrl)) {
		url.searchParams.append('return_url', returnUrl as string);
		localStorage.setItem('return_url', returnUrl as string);
	} else {
		localStorage.removeItem('return_url');
	}

	setLastLoginProvider('google');
	window.location.href = url.toString();
}
