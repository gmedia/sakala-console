import type { PanelHelpLink } from '$lib/components/panel/panel';
import { LEGAL_LINKS } from '$lib/config/project';

/** The words of the account settings page's panel (docs/UI_GUIDELINES.md, text budget). */
export const ACCOUNT_PANEL_COPY = {
	label: 'Bantuan akun',
	nav: 'Bagian pengaturan akun',
	privacy: 'Pemberitahuan Privasi',
	terms: 'Syarat Layanan',
	acceptableUse: 'Kebijakan Penggunaan Wajar'
} as const;

/**
 * The account page has no next steps: its Bantuan card holds the documents that say what happens
 * to the account's data, on every tab, each opening in a new tab.
 */
export const ACCOUNT_HELP_LINKS: readonly PanelHelpLink[] = [
	{ label: ACCOUNT_PANEL_COPY.privacy, href: LEGAL_LINKS.privacy },
	{ label: ACCOUNT_PANEL_COPY.terms, href: LEGAL_LINKS.terms },
	{ label: ACCOUNT_PANEL_COPY.acceptableUse, href: LEGAL_LINKS.acceptableUse }
];
