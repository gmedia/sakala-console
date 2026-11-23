import { redirect } from '@sveltejs/kit';
import { settingsHref } from '$lib/features/settings/tabs';

// The profile is a tab of Pengaturan now; old links and bookmarks land on it.
export function load() {
	redirect(307, settingsHref('profile'));
}
