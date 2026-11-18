import { MONITORING_COPY } from '../monitoring/format';

export type ProjectTab = 'overview' | 'deployments' | 'monitoring' | 'environments' | 'settings';

/** Short, so all five fit a 320 px screen with the tight spacing below 640 px. */
export const PROJECT_TAB_LABELS: Record<ProjectTab, string> = {
	overview: 'Ringkasan',
	deployments: 'Riwayat',
	monitoring: MONITORING_COPY.tab,
	environments: 'Variabel',
	settings: 'Pengaturan'
};

/** Tab order: the overview first, as the project's default page at `/projects/{id}`. */
export const PROJECT_TABS: readonly ProjectTab[] = [
	'overview',
	'deployments',
	'monitoring',
	'environments',
	'settings'
];

/**
 * The tab a path belongs to. The overview is the project's own address; every other tab owns its
 * segment and anything below it, so a deployment's page keeps Riwayat marked.
 */
export function activeProjectTab(pathname: string, projectId: string): ProjectTab | null {
	const base = `/projects/${projectId}`;
	const path = pathname.replace(/\/+$/, '');
	if (path === base) return 'overview';
	if (!path.startsWith(`${base}/`)) return null;
	const segment = path.slice(base.length + 1).split('/')[0];
	return PROJECT_TABS.find((tab) => tab !== 'overview' && tab === segment) ?? null;
}
