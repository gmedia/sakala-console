import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import {
	isValidInternalPath,
	getPendingOAuthProvider,
	setLastLoginProvider,
	clearPendingOAuthProvider
} from '$lib/features/auth/utils/oauth';

export function load() {
	if (browser) {
		const pendingProvider = getPendingOAuthProvider();
		if (pendingProvider) {
			setLastLoginProvider(pendingProvider);
			clearPendingOAuthProvider();
		}

		const returnUrl = localStorage.getItem('return_url');
		if (returnUrl) {
			localStorage.removeItem('return_url');
			if (isValidInternalPath(returnUrl)) {
				redirect(307, returnUrl);
			}
		}
	}

	redirect(307, '/projects');
}
