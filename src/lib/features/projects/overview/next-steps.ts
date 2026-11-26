import {
	isLaravelStack,
	LARAVEL_RELEASE_COMMAND,
	RELEASE_COMMAND_DOCS_URL,
	RELEASE_COMMAND_LABEL
} from '../build-help';
import { SUGGESTION_COPY } from '../env-suggestions/presentation';
import { SETTINGS_ANCHORS, VARIABLES_ANCHORS } from '../settings-anchors';
import { maxReplicasOf, replicasOf, MIN_REPLICAS } from '../replicas';
import type { Project } from '../type';
import type { TopologyTarget } from './topology';

export { RELEASE_COMMAND_DOCS_URL };

/** The overview never asks for more than this, so the card stays a short list (Hick's Law). */
export const MAX_NEXT_STEPS = 3;

export type NextStepId = 'env-example' | 'release-command' | 'auto-deploy' | 'replicas';

/** A setting the step points at, as an anchor on the settings tab. */
export type NextStepTarget = Extract<TopologyTarget, 'variables'> | 'settings';

export type NextStep = {
	id: NextStepId;
	title: string;
	body: string;
	/** A command to type, shown as code under the body. */
	command?: string;
	action: { label: string; target: NextStepTarget; anchor?: string };
	docs?: { label: string; href: string };
};

type NextStepProject = Pick<
	Project,
	| 'status'
	| 'branch'
	| 'repository_source'
	| 'auto_deploy'
	| 'release_command'
	| 'stack'
	| 'inspection'
	| 'replicas'
	| 'max_replicas'
>;

export type NextStepContext = {
	/** `null` until the list is read; a step about variables waits for it. */
	variablesCount: number | null;
	/** Viewers cannot change settings, so nothing is suggested to them. */
	readOnly: boolean;
};

const countFormat = new Intl.NumberFormat('id-ID');

/** Each rule reads real state and either suggests one thing or stays quiet. Order is priority. */
const RULES: ((project: NextStepProject, context: NextStepContext) => NextStep | null)[] = [
	(project, { variablesCount }) =>
		project.inspection?.env_example_found && variablesCount === 0
			? {
					id: 'env-example',
					title: 'Isi environment variable dari .env.example',
					body: 'Repository-mu punya file .env.example, tetapi proyek ini belum punya environment variable. Aplikasi yang membaca nilai dari sana bisa gagal berjalan tanpanya.',
					// With the file's entries, the Variabel tab opens Sakala's suggestions directly.
					action: project.inspection.env_example?.entries.length
						? {
								label: SUGGESTION_COPY.tabAction,
								target: 'variables',
								anchor: VARIABLES_ANCHORS.envExample
							}
						: { label: 'Buka Variabel', target: 'variables' }
				}
			: null,
	(project) =>
		!project.release_command?.trim() && isLaravelStack(project.stack)
			? {
					id: 'release-command',
					title: 'Jalankan migration lewat release command',
					body: `Kalau aplikasi Laravel-mu memakai database, ${RELEASE_COMMAND_LABEL.toLowerCase()} menjalankan migration sekali setiap deploy, sebelum versi baru menerima trafik. Untuk Laravel biasanya:`,
					command: LARAVEL_RELEASE_COMMAND,
					action: {
						label: `Atur ${RELEASE_COMMAND_LABEL.toLowerCase()}`,
						target: 'settings',
						anchor: SETTINGS_ANCHORS.releaseCommand
					},
					docs: { label: 'Baca panduannya', href: RELEASE_COMMAND_DOCS_URL }
				}
			: null,
	// Only the GitHub App sends push webhooks, so a public URL project cannot turn it on.
	(project) =>
		project.repository_source === 'github_installation' && !project.auto_deploy
			? {
					id: 'auto-deploy',
					title: 'Nyalakan auto-deploy',
					body: `Setiap push ke branch ${project.branch} langsung di-deploy, jadi kamu tidak perlu menekan Redeploy setelah push.`,
					action: {
						label: 'Buka pengaturan auto-deploy',
						target: 'settings',
						anchor: SETTINGS_ANCHORS.autoDeploy
					}
				}
			: null,
	(project) => {
		const max = maxReplicasOf(project);
		return replicasOf(project) === MIN_REPLICAS && max > MIN_REPLICAS
			? {
					id: 'replicas',
					title: 'Pertimbangkan replika',
					body: `Workspace ini mengizinkan sampai ${countFormat.format(max)} replika. Replika membagi pengunjung ke beberapa salinan aplikasi, cocok untuk aplikasi yang tidak menyimpan file atau sesi di disk container.`,
					action: { label: 'Atur replika', target: 'settings', anchor: SETTINGS_ANCHORS.replicas }
				}
			: null;
	}
];

/**
 * Up to three suggestions from the project's real state, without the ones the user hid. A
 * suspended project and a viewer get none: neither can act on them.
 */
export function deriveNextSteps(
	project: NextStepProject,
	context: NextStepContext,
	dismissed: ReadonlySet<string> = new Set()
): NextStep[] {
	if (context.readOnly || project.status === 'suspended') return [];
	return RULES.map((rule) => rule(project, context))
		.filter((step): step is NextStep => step !== null && !dismissed.has(step.id))
		.slice(0, MAX_NEXT_STEPS);
}

export type DismissalStorage = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_PREFIX = 'sakala.overview-dismissed-steps';

/** Whose choice it is: hiding a step on a shared browser says nothing about another person. */
export type DismissalOwner = string | number | null | undefined;

/**
 * Per person and per project: hiding a suggestion on one project says nothing about another. The
 * key without a person is the one used before choices were kept per person; it is still read once,
 * so a step hidden then stays hidden.
 */
export function dismissalStorageKey(projectId: string, owner?: DismissalOwner): string {
	return owner === null || owner === undefined
		? `${STORAGE_PREFIX}.${projectId}`
		: `${STORAGE_PREFIX}.${owner}.${projectId}`;
}

function parseIds(raw: string | null): Set<string> | null {
	if (raw === null) return null;
	const parsed: unknown = JSON.parse(raw);
	return new Set(
		Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
	);
}

/** Storage can be missing, refuse access, or hold junk; any of those only forgets the choice. */
export function readDismissedSteps(
	storage: DismissalStorage | null,
	projectId: string,
	owner?: DismissalOwner
): Set<string> {
	try {
		const own = parseIds(storage?.getItem(dismissalStorageKey(projectId, owner)) ?? null);
		if (own) return own;
		const legacy = owner === null || owner === undefined ? null : dismissalStorageKey(projectId);
		return (legacy && parseIds(storage?.getItem(legacy) ?? null)) || new Set();
	} catch {
		return new Set();
	}
}

/** An empty set is written too: it is how a restore outlives the key from before. */
export function writeDismissedSteps(
	storage: DismissalStorage | null,
	projectId: string,
	ids: ReadonlySet<string>,
	owner?: DismissalOwner
): void {
	try {
		storage?.setItem(dismissalStorageKey(projectId, owner), JSON.stringify([...ids]));
	} catch {
		// Hiding still holds for this visit.
	}
}
