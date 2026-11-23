/**
 * Ids of settings tab fields that other pages link to (`/projects/{id}/settings#releaseCommand`).
 * The project overview's next steps land on them, so they stay stable.
 */
export const SETTINGS_ANCHORS = {
	releaseCommand: 'releaseCommand',
	autoDeploy: 'auto-deploy',
	replicas: 'replicas'
} as const;

/** The sections of the settings tab, as ids their links at the top jump to. */
export const SETTINGS_SECTION_IDS = {
	general: 'umum',
	build: 'build-dan-start',
	advanced: 'lanjutan',
	danger: 'zona-berbahaya'
} as const;

/**
 * The section links, in page order. A later section (Domain, for one) goes in here and gets its
 * link without reworking the page.
 */
export const SETTINGS_SECTIONS = [
	{ id: SETTINGS_SECTION_IDS.general, label: 'Umum' },
	{ id: SETTINGS_SECTION_IDS.build, label: 'Build dan start' },
	{ id: SETTINGS_SECTION_IDS.advanced, label: 'Lanjutan' },
	{ id: SETTINGS_SECTION_IDS.danger, label: 'Zona berbahaya' }
] as const;

/**
 * Anchors in the section that starts closed: arriving at one opens it first, so the field can be
 * seen.
 */
export const ADVANCED_ANCHORS: readonly string[] = [
	SETTINGS_SECTION_IDS.advanced,
	SETTINGS_ANCHORS.releaseCommand,
	SETTINGS_ANCHORS.replicas
];

/** Ids on the Variabel tab that other pages link to (`/projects/{id}/environments#isi-dari-env-example`). */
export const VARIABLES_ANCHORS = {
	/** Opens the suggestions from the repository's `.env.example`. */
	envExample: 'isi-dari-env-example'
} as const;
