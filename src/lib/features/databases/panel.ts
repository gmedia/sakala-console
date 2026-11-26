import type { PanelHelpLink, PanelStep } from '$lib/components/panel/panel';
import type { Database } from '$lib/api/resources/databases';
import { DATABASE_GUIDE_URL, RELEASE_COMMAND_DOCS_URL } from '$lib/config/project';

/** Ids on the database's page the panel's next steps land on. */
export const DATABASE_ANCHORS = {
	projects: 'database-projects'
} as const;

/** The words of the database page's side panel and fact line (docs/UI_GUIDELINES.md, text budget). */
export const DATABASE_PANEL_COPY = {
	label: 'Langkah dan bantuan database',
	autoRegion: 'region otomatis',
	projects: (count: string) => `${count} proyek`,
	created: (date: string) => `dibuat ${date}`,
	attach: 'Pasang ke proyek',
	guide: 'Panduan database',
	releaseGuide: 'Release command',
	migration: 'Migration',
	migrationTopic: 'menjalankan migration',
	releaseBody:
		'Sakala tidak menjalankan migration sendiri. Isi release command di pengaturan proyek: perintah itu jalan sekali setiap deploy, setelah build dan sebelum versi baru menerima trafik.',
	laravel: 'Untuk Laravel biasanya:'
} as const;

/** Guides for the Bantuan card; each opens in a new tab. */
export const DATABASE_HELP_LINKS: readonly PanelHelpLink[] = [
	{ label: DATABASE_PANEL_COPY.guide, href: DATABASE_GUIDE_URL },
	{ label: DATABASE_PANEL_COPY.releaseGuide, href: RELEASE_COMMAND_DOCS_URL }
];

type StepDatabase = Pick<Database, 'status' | 'projects'>;

/**
 * The next step that applies to the database now, for someone who may change it: attach it while no
 * project uses it. It goes away by itself once a project is attached, so it needs no way to hide it.
 * A database still being made, locked, failed, or removed gets none: attaching would not go through.
 */
export function deriveDatabaseSteps(database: StepDatabase, canManage: boolean): PanelStep[] {
	if (!canManage || database.status !== 'ready') return [];
	if (database.projects.length > 0) return [];
	return [
		{ id: 'attach', label: DATABASE_PANEL_COPY.attach, href: `#${DATABASE_ANCHORS.projects}` }
	];
}
