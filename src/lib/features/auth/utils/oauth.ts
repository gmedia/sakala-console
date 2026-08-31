import { PUBLIC_API_URL } from '$env/static/public';

export function redirectToGithubAuth(returnUrl?: string) {
	const url = new URL(`${PUBLIC_API_URL}/auth/github/redirect`);

	if (returnUrl && returnUrl.startsWith('/')) {
		url.searchParams.append('return_url', returnUrl);
		localStorage.setItem('return_url', returnUrl);
	} else {
		localStorage.removeItem('return_url');
	}

	window.location.href = url.toString();
}
