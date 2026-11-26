import { MAX_PANEL_STEPS } from '$lib/components/panel/panel';
import { isLaravelStack, RELEASE_COMMAND_LABEL } from '../build-help';
import { SUGGESTION_COPY } from '../env-suggestions/presentation';
import { SETTINGS_ANCHORS, VARIABLES_ANCHORS } from '../settings-anchors';
import { maxReplicasOf, replicasOf, MIN_REPLICAS } from '../replicas';
import type { Project } from '../type';
import type { TopologyTarget } from './topology';

/** The overview never asks for more than this, so the card stays a short list (Hick's Law). */
export const MAX_NEXT_STEPS = MAX_PANEL_STEPS;

export type NextStepId = 'env-example' | 'release-command' | 'auto-deploy' | 'replicas';

/** A setting the step points at, as an anchor on the settings tab. */
export type NextStepTarget = Extract<TopologyTarget, 'variables'> | 'settings';

/**
 * The step's label, four words at most (docs/UI_GUIDELINES.md, Berikutnya). The why behind each one
 * lives where the link leads: the field's hint and "Pelajari" on that page.
 */
export const NEXT_STEP_LABELS = {
	envExample: SUGGESTION_COPY.tabAction,
	envVariables: 'Isi environment variable',
	releaseCommand: `Atur ${RELEASE_COMMAND_LABEL.toLowerCase()}`,
	autoDeploy: 'Nyalakan auto-deploy',
	replicas: 'Tambah replika'
} as const;

/** A next step: a short label and the place it leads to. */
export type NextStep = {
	id: NextStepId;
	label: string;
	action: { target: NextStepTarget; anchor?: string };
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

/** Each rule reads real state and either suggests one thing or stays quiet. Order is priority. */
const RULES: ((project: NextStepProject, context: NextStepContext) => NextStep | null)[] = [
	(project, { variablesCount }) => {
		if (!project.inspection?.env_example_found || variablesCount !== 0) return null;
		// With the file's entries, the Variabel tab opens Sakala's suggestions directly.
		return project.inspection.env_example?.entries.length
			? {
					id: 'env-example',
					label: NEXT_STEP_LABELS.envExample,
					action: { target: 'variables', anchor: VARIABLES_ANCHORS.envExample }
				}
			: {
					id: 'env-example',
					label: NEXT_STEP_LABELS.envVariables,
					action: { target: 'variables' }
				};
	},
	(project) =>
		!project.release_command?.trim() && isLaravelStack(project.stack)
			? {
					id: 'release-command',
					label: NEXT_STEP_LABELS.releaseCommand,
					action: { target: 'settings', anchor: SETTINGS_ANCHORS.releaseCommand }
				}
			: null,
	// Only the GitHub App sends push webhooks, so a public URL project cannot turn it on.
	(project) =>
		project.repository_source === 'github_installation' && !project.auto_deploy
			? {
					id: 'auto-deploy',
					label: NEXT_STEP_LABELS.autoDeploy,
					action: { target: 'settings', anchor: SETTINGS_ANCHORS.autoDeploy }
				}
			: null,
	(project) =>
		replicasOf(project) === MIN_REPLICAS && maxReplicasOf(project) > MIN_REPLICAS
			? {
					id: 'replicas',
					label: NEXT_STEP_LABELS.replicas,
					action: { target: 'settings', anchor: SETTINGS_ANCHORS.replicas }
				}
			: null
];

/** Every suggestion that applies now, hidden or not. A suspended project and a viewer get none. */
function applicableNextSteps(project: NextStepProject, context: NextStepContext): NextStep[] {
	if (context.readOnly || project.status === 'suspended') return [];
	return RULES.map((rule) => rule(project, context)).filter(
		(step): step is NextStep => step !== null
	);
}

/**
 * Up to three suggestions from the project's real state, without the ones the user hid. A
 * suspended project and a viewer get none: neither can act on them.
 */
export function deriveNextSteps(
	project: NextStepProject,
	context: NextStepContext,
	dismissed: ReadonlySet<string> = new Set()
): NextStep[] {
	return applicableNextSteps(project, context)
		.filter((step) => !dismissed.has(step.id))
		.slice(0, MAX_NEXT_STEPS);
}

/** How many suggestions that apply now this person hid, so the card can offer them back. */
export function hiddenNextStepCount(
	project: NextStepProject,
	context: NextStepContext,
	dismissed: ReadonlySet<string>
): number {
	return applicableNextSteps(project, context).filter((step) => dismissed.has(step.id)).length;
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
