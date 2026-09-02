import { env } from '$env/dynamic/public';

const apiUrl = env.PUBLIC_API_URL;

export function isValidInternalPath(path: string | null | undefined): boolean {
	if (!path) return false;
	return path.startsWith('/') && !path.startsWith('//');
}

export function redirectToGithubAuth(returnUrl?: string | null) {
	const url = new URL(`${apiUrl}/auth/github/redirect`);

	if (isValidInternalPath(returnUrl)) {
		url.searchParams.append('return_url', returnUrl as string);
		localStorage.setItem('return_url', returnUrl as string);
	} else {
		localStorage.removeItem('return_url');
	}

	window.location.href = url.toString();
}
