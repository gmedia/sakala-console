import { publicConfig } from '$lib/config/public';

const apiUrl = publicConfig.apiUrl;

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
const PENDING_OAUTH_PROVIDER_KEY = 'pending_oauth_provider';

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

export function getPendingOAuthProvider(): AuthProviderId | null {
	if (typeof window === 'undefined') return null;
	const val = localStorage.getItem(PENDING_OAUTH_PROVIDER_KEY);
	if (val === 'github' || val === 'google') {
		return val;
	}
	return null;
}

export function setPendingOAuthProvider(provider: 'github' | 'google'): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(PENDING_OAUTH_PROVIDER_KEY, provider);
}

export function clearPendingOAuthProvider(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(PENDING_OAUTH_PROVIDER_KEY);
}

export function redirectToGithubAuth(returnUrl?: string | null) {
	const url = new URL(`${apiUrl}/auth/github/redirect`);

	if (isValidInternalPath(returnUrl)) {
		url.searchParams.append('return_url', returnUrl as string);
		localStorage.setItem('return_url', returnUrl as string);
	} else {
		localStorage.removeItem('return_url');
	}

	setPendingOAuthProvider('github');
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

	setPendingOAuthProvider('google');
	window.location.href = url.toString();
}

/** The install route lives on the API: Caddy serves the console's own `/auth` from the SPA fallback. */
export function githubInstallUrl(): string {
	return new URL('/auth/github/install', apiUrl).toString();
}

export function githubConfigureUrl(installationId: string): string {
	return new URL(`/auth/github/installations/${installationId}/configure`, apiUrl).toString();
}

/**
 * A suspended installation can be resumed from its settings page on GitHub. A removed one has no
 * such page anymore, so it needs a new install.
 */
export function githubReconnectUrl(
	installation: { id: string; status: string } | null | undefined
): string {
	if (!installation || installation.status === 'removed') return githubInstallUrl();
	return githubConfigureUrl(installation.id);
}

export function redirectToGithubInstall() {
	window.location.href = githubInstallUrl();
}

/** Login path that brings the user back to where the session ended. */
export function loginPathWithReturnTo(url: Pick<URL, 'pathname' | 'search'>): string {
	return `/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`;
}
