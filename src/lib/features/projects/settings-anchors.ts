/**
 * Ids of settings fields that other pages link to (`/projects/{id}/settings/build#releaseCommand`).
 * The project overview's next steps land on them, so they stay stable.
 */
export const SETTINGS_ANCHORS = {
	releaseCommand: 'releaseCommand',
	autoDeploy: 'auto-deploy',
	replicas: 'replicas'
} as const;

/**
 * The sections of the settings, by the ids the single settings page used for them. Links from
 * before the split (`/settings#jadwal`) still carry them, so each maps to its page below.
 */
export const SETTINGS_SECTION_IDS = {
	general: 'umum',
	build: 'build-dan-start',
	advanced: 'lanjutan',
	/** Custom domains (ADR-024), only while the installation has them on. */
	domains: 'domain',
	/** Worker processes (ADR-022), only while the installation has them on. */
	processes: 'proses',
	/** Schedules (ADR-022), only while the installation has them on. */
	schedules: 'jadwal',
	danger: 'zona-berbahaya'
} as const;

/** The settings sub-pages, as their route segments under `/projects/{id}/settings/`. */
export const SETTINGS_PAGES = {
	general: 'general',
	build: 'build',
	domains: 'domain',
	processes: 'processes',
	schedules: 'schedules',
	danger: 'danger'
} as const;

export type SettingsPage = (typeof SETTINGS_PAGES)[keyof typeof SETTINGS_PAGES];

/** The two pages that edit the project form; they share one draft and one Save. */
export type SettingsFormPage = typeof SETTINGS_PAGES.general | typeof SETTINGS_PAGES.build;

/**
 * The sub-navigation, in page order, one link per page. Lanjutan lives on Build dan start, folded.
 * Domain, Proses, and Jadwal are listed only while the installation offers them (`settingsSections`).
 */
export const SETTINGS_SECTIONS = [
	{ id: SETTINGS_SECTION_IDS.general, page: SETTINGS_PAGES.general, label: 'Umum' },
	{ id: SETTINGS_SECTION_IDS.build, page: SETTINGS_PAGES.build, label: 'Build dan start' },
	{ id: SETTINGS_SECTION_IDS.domains, page: SETTINGS_PAGES.domains, label: 'Domain' },
	{ id: SETTINGS_SECTION_IDS.processes, page: SETTINGS_PAGES.processes, label: 'Proses' },
	{ id: SETTINGS_SECTION_IDS.schedules, page: SETTINGS_PAGES.schedules, label: 'Jadwal' },
	{ id: SETTINGS_SECTION_IDS.danger, page: SETTINGS_PAGES.danger, label: 'Zona berbahaya' }
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function settingsSectionOf(page: SettingsPage): SettingsSection {
	return SETTINGS_SECTIONS.find((section) => section.page === page) ?? SETTINGS_SECTIONS[0];
}

/**
 * The sections this project's settings show: custom domains, workers, and schedules only where they
 * are on. `domains` is optional so a caller without ADR-024 reads it as off.
 */
export function settingsSections(features: {
	workers: boolean;
	schedules: boolean;
	domains?: boolean;
}): readonly SettingsSection[] {
	return SETTINGS_SECTIONS.filter(
		(section) =>
			(section.id !== SETTINGS_SECTION_IDS.domains || features.domains === true) &&
			(section.id !== SETTINGS_SECTION_IDS.processes || features.workers) &&
			(section.id !== SETTINGS_SECTION_IDS.schedules || features.schedules)
	);
}

/** Name, branch, and auto-deploy are on Umum; every other form field is on Build dan start. */
const GENERAL_FIELDS: readonly string[] = ['name', 'branch', 'auto_deploy'];

/** The form page a field of the settings form is on. */
export function settingsFormPageOf(field: string): SettingsFormPage {
	return GENERAL_FIELDS.includes(field) ? SETTINGS_PAGES.general : SETTINGS_PAGES.build;
}

/** The form pages holding changes that are not saved yet. */
export function dirtySettingsPages(fields: readonly string[]): Set<SettingsFormPage> {
	return new Set(fields.map(settingsFormPageOf));
}

/** Every anchor a link may carry, and the page that holds it now. */
const ANCHOR_PAGES: Record<string, SettingsPage> = {
	[SETTINGS_SECTION_IDS.general]: SETTINGS_PAGES.general,
	[SETTINGS_ANCHORS.autoDeploy]: SETTINGS_PAGES.general,
	[SETTINGS_SECTION_IDS.build]: SETTINGS_PAGES.build,
	[SETTINGS_SECTION_IDS.advanced]: SETTINGS_PAGES.build,
	[SETTINGS_ANCHORS.releaseCommand]: SETTINGS_PAGES.build,
	[SETTINGS_ANCHORS.replicas]: SETTINGS_PAGES.build,
	[SETTINGS_SECTION_IDS.domains]: SETTINGS_PAGES.domains,
	[SETTINGS_SECTION_IDS.processes]: SETTINGS_PAGES.processes,
	[SETTINGS_SECTION_IDS.schedules]: SETTINGS_PAGES.schedules,
	[SETTINGS_SECTION_IDS.danger]: SETTINGS_PAGES.danger
};

/**
 * Where an anchor lands: its page, and the anchor still to scroll to there. A section's own id is
 * the page itself, so it needs no anchor; an unknown one goes to Umum and keeps its anchor.
 */
export function settingsTarget(anchor?: string | null): {
	page: SettingsPage;
	anchor: string | null;
} {
	if (!anchor) return { page: SETTINGS_PAGES.general, anchor: null };
	const page = ANCHOR_PAGES[anchor] ?? SETTINGS_PAGES.general;
	const isSection = SETTINGS_SECTIONS.some((section) => section.id === anchor);
	return { page, anchor: isSection ? null : anchor };
}

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
