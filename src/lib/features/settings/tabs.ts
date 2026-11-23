import { resolve } from '$app/paths';

/**
 * The tabs of the account settings page, in the order of its sub-navigation. Everything about the
 * account lives on this one page; `/profile` sends people to the Profil tab.
 */
export const SETTINGS_TABS = [
	{ id: 'profile', label: 'Profil' },
	{ id: 'account', label: 'Akun dan keamanan' },
	{ id: 'notifications', label: 'Notifikasi' }
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

/** The first tab, which `/settings` without a `tab` opens. */
export const DEFAULT_SETTINGS_TAB: SettingsTab = SETTINGS_TABS[0].id;

/** The tab named in `?tab=`, or the default for a missing or unknown one. */
export function settingsTabFrom(value: string | null | undefined): SettingsTab {
	return SETTINGS_TABS.find((tab) => tab.id === value)?.id ?? DEFAULT_SETTINGS_TAB;
}

/** The address of one tab, for links from other pages and for `/profile`. */
export function settingsHref(tab: SettingsTab): string {
	return `${resolve('/settings')}?tab=${tab}`;
}
