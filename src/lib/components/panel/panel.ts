/**
 * The right panel of the form template (docs/UI_GUIDELINES.md): the same three cards with the same
 * names on every page that has one.
 */
export const PANEL_COPY = {
	summary: 'Ringkasan',
	next: 'Berikutnya',
	help: 'Bantuan',
	newTab: '(tab baru)'
} as const;

/** More than three suggestions turns a nudge into a to-do list (Hick's Law). */
export const MAX_PANEL_STEPS = 3;

/** A next step: a short label (four words at most) and where it leads, on this page or another. */
export type PanelStep = { id: string; label: string; href: string };

/** A guide in the Bantuan card; it opens in a new tab. */
export type PanelHelpLink = { label: string; href: string };
