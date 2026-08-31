import { env } from '$env/dynamic/public';

const apiUrl = env.PUBLIC_API_URL;

export function redirectToGithubAuth(returnUrl?: string) {
	const url = new URL(`${apiUrl}/auth/github/redirect`);

	if (returnUrl && returnUrl.startsWith('/')) {
		url.searchParams.append('return_url', returnUrl);
		localStorage.setItem('return_url', returnUrl);
	} else {
		localStorage.removeItem('return_url');
	}

	window.location.href = url.toString();
}
