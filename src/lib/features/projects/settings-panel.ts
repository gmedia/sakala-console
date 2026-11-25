import {
	DEPLOY_FAILURE_GUIDE_URL,
	DEPLOY_GUIDE_URL,
	RELEASE_COMMAND_DOCS_URL
} from '$lib/config/project';
import type { DomainQuota } from '$lib/features/domains/presentation';
import { processSuggestion } from '$lib/features/workloads/processes';
import { scheduleSuggestion } from '$lib/features/workloads/schedules';
import { RELEASE_COMMAND_LABEL } from './build-help';
import { MAX_PANEL_STEPS } from '$lib/components/panel/panel';
import { deriveNextSteps, type NextStepId } from './overview/next-steps';
import { SETTINGS_ANCHORS, SETTINGS_SECTION_IDS } from './settings-anchors';
import type { Project } from './type';

/**
 * The words of the settings page's side panel: card titles of up to four words, one line per state
 * (maintainer, 2026-11-25).
 */
export const SETTINGS_PANEL_COPY = {
	label: 'Ringkasan proyek',
	status: 'Status',
	address: 'Alamat',
	sakalaAddress: 'Alamat Sakala',
	noAddress: 'Belum ada',
	branch: 'Branch',
	port: 'Port',
	nextPort: (port: number) => `${port} setelah deploy`,
	changes: 'Perubahan',
	unsaved: 'Belum disimpan',
	unsavedNote: 'Simpan, atau Redeploy untuk menyimpan sekaligus deploy.'
} as const;

/** Every suggestion the panel knows, in priority order; a project gets the first three that apply. */
export type SettingsStepId =
	| Extract<NextStepId, 'release-command' | 'auto-deploy' | 'replicas'>
	| 'domain'
	| 'worker'
	| 'schedule';

export type SettingsStep = {
	id: SettingsStepId;
	label: string;
	/** An id on this page: a section, or a field the page opens and scrolls to. */
	anchor: string;
};

const STEPS: Record<SettingsStepId, Omit<SettingsStep, 'id'>> = {
	'release-command': {
		label: `Atur ${RELEASE_COMMAND_LABEL.toLowerCase()}`,
		anchor: SETTINGS_ANCHORS.releaseCommand
	},
	domain: { label: 'Pasang custom domain', anchor: SETTINGS_SECTION_IDS.domains },
	worker: { label: 'Tambah worker antrean', anchor: SETTINGS_SECTION_IDS.processes },
	schedule: { label: 'Buat jadwal Laravel', anchor: SETTINGS_SECTION_IDS.schedules },
	'auto-deploy': { label: 'Nyalakan auto-deploy', anchor: SETTINGS_ANCHORS.autoDeploy },
	replicas: { label: 'Tambah replika', anchor: SETTINGS_ANCHORS.replicas }
};

const ORDER: readonly SettingsStepId[] = [
	'release-command',
	'domain',
	'worker',
	'schedule',
	'auto-deploy',
	'replicas'
];

type StepProject = Parameters<typeof deriveNextSteps>[0] & Pick<Project, 'stack'>;

export type SettingsStepContext = {
	readOnly: boolean;
	/** Suggestions hidden on the overview stay hidden here: one choice, one place to make it. */
	dismissed?: ReadonlySet<string>;
	/** The project's custom domains, `undefined` while the feature is off or the list loads. */
	domains?: readonly { status: string }[];
	domainQuota?: DomainQuota | null;
	/** The project's workers and schedules, `undefined` while off or loading. */
	processes?: readonly { name: string; command: string }[];
	schedules?: readonly { command: string }[];
};

/**
 * Up to three next steps for the settings page, each only when it applies to this project now:
 * the overview's own rules (release command, auto-deploy, replicas), plus a custom domain while the
 * workspace has room for one, and the Laravel worker and scheduler while the project has neither.
 * A viewer and a suspended project get none, as on the overview.
 */
export function deriveSettingsSteps(
	project: StepProject,
	context: SettingsStepContext
): SettingsStep[] {
	if (context.readOnly || project.status === 'suspended') return [];
	const framework = project.stack?.framework?.toLowerCase() ?? null;
	const applies = new Set<string>(
		// The variables count is the Variabel tab's concern, so its step never fires here.
		deriveNextSteps(project, { variablesCount: null, readOnly: false }).map((step) => step.id)
	);
	const quota = context.domainQuota;
	if (
		context.domains &&
		quota &&
		!quota.full &&
		context.domains.every((domain) => domain.status === 'released')
	) {
		applies.add('domain');
	}
	if (context.processes && processSuggestion(framework, context.processes)) applies.add('worker');
	if (context.schedules && scheduleSuggestion(framework, context.schedules)) {
		applies.add('schedule');
	}
	return ORDER.filter((id) => applies.has(id) && !context.dismissed?.has(id))
		.slice(0, MAX_PANEL_STEPS)
		.map((id) => ({ id, ...STEPS[id] }));
}

/** Guides that answer what the settings page asks; short names, each opens the docs. */
export const SETTINGS_HELP_LINKS = [
	{ label: 'Deploy pertama', href: DEPLOY_GUIDE_URL },
	{ label: RELEASE_COMMAND_LABEL, href: RELEASE_COMMAND_DOCS_URL },
	{ label: 'Kalau deploy gagal', href: DEPLOY_FAILURE_GUIDE_URL }
] as const;
