import { browser } from '$app/environment';
import { clearPendingOAuthProvider } from '$lib/features/auth/utils/oauth';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	if (browser && url.searchParams.get('error')) {
		clearPendingOAuthProvider();
		localStorage.removeItem('return_url');
	}
};
