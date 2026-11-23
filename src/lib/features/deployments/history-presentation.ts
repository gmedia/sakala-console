import type { components } from '$lib/api/generated/schema';
import type { WorkspaceType } from '$lib/api/resources/workspaces';
import { getDeploymentTriggerLabel } from './deployment-presentation';

type GeneratedDeployment = components['schemas']['DeploymentResource'];

/** The `trigger` values this module words differently; any other keeps its plain label. */
export const DEPLOYMENT_TRIGGERS = {
	manual: 'manual',
	redeploy: 'redeploy',
	webhook: 'webhook',
	rollback: 'rollback'
} as const satisfies Record<string, GeneratedDeployment['trigger']>;

/** Who started a deployment, as `triggered_by.kind` says. */
export const TRIGGERED_BY_KINDS = {
	user: 'user',
	githubPush: 'github_push',
	system: 'system'
} as const satisfies Record<string, GeneratedDeployment['triggered_by']['kind']>;

/**
 * The runtime statuses in which the active deployment is the version visitors get. While a new
 * deployment runs, the agent cuts over last, so the active one still serves (`deploying`), as the
 * project header says too.
 */
export const SERVING_RUNTIME_STATUSES: readonly string[] = ['running', 'sleeping', 'deploying'];

export const HISTORY_COPY = {
	serving: 'Sedang melayani',
	/** For the row's link, which a screen reader announces as one name. */
	servingAccessible: 'sedang melayani',
	/** Before the linked number of the version a rollback went back to. */
	rollbackToLead: 'Rollback ke'
} as const;

const TRIGGER_COPY = {
	rollbackTo: (sequence: number) => `${HISTORY_COPY.rollbackToLead} #${sequence}`,
	byManual: (name: string) => `${name}, deploy manual`,
	byRedeploy: (name: string) => `${name}, redeploy manual`,
	byPush: (name: string, branch: string) => `${name}, push ke ${branch}`,
	byRollbackTo: (name: string, sequence: number) => `${name}, rollback ke #${sequence}`,
	byRollback: (name: string) => `${name}, rollback`
} as const;

type ServingDeployment = { is_active: boolean };

/**
 * The deployment visitors get now: the active one while the project runs, sleeps (it wakes into
 * it), or deploys a new version over it. A project that crashed, stopped, failed, or never went live
 * has none, and before a first deployment nothing is active.
 */
export function isServingDeployment(
	deployment: ServingDeployment,
	runtimeStatus: string | null | undefined
): boolean {
	return deployment.is_active && SERVING_RUNTIME_STATUSES.includes(runtimeStatus ?? '');
}

export type TriggerDeployment = {
	trigger: string;
	branch: string;
	triggered_by?: GeneratedDeployment['triggered_by'];
	rollback?: GeneratedDeployment['rollback'];
};

/** "Rollback ke #4", or "Rollback" once the target is unknown. */
export function getRollbackLabel(deployment: TriggerDeployment): string {
	const sequence = deployment.rollback?.target_sequence;
	return sequence == null
		? getDeploymentTriggerLabel(deployment.trigger)
		: TRIGGER_COPY.rollbackTo(sequence);
}

/** The actor's words, or null when this trigger has no sentence with a name. */
function withActor(deployment: TriggerDeployment, name: string): string | null {
	const sequence = deployment.rollback?.target_sequence;
	switch (deployment.trigger) {
		case DEPLOYMENT_TRIGGERS.manual:
			return TRIGGER_COPY.byManual(name);
		case DEPLOYMENT_TRIGGERS.redeploy:
			return TRIGGER_COPY.byRedeploy(name);
		case DEPLOYMENT_TRIGGERS.webhook:
			return TRIGGER_COPY.byPush(name, deployment.branch);
		case DEPLOYMENT_TRIGGERS.rollback:
			return sequence == null
				? TRIGGER_COPY.byRollback(name)
				: TRIGGER_COPY.byRollbackTo(name, sequence);
		default:
			return null;
	}
}

/**
 * The Pemicu of a deployment. In a team workspace it names who started it ("Rani, redeploy manual",
 * "Bima, push ke main"); a personal workspace has one person, so it keeps the plain label, as does
 * a deployment whose actor is not known.
 */
export function describeDeploymentTrigger(
	deployment: TriggerDeployment,
	workspaceType: WorkspaceType | null | undefined
): string {
	const name = deployment.triggered_by?.name?.trim();
	const named =
		workspaceType === 'team' && name && deployment.triggered_by?.kind !== TRIGGERED_BY_KINDS.system
			? withActor(deployment, name)
			: null;
	if (named) return named;
	if (deployment.trigger === DEPLOYMENT_TRIGGERS.rollback) return getRollbackLabel(deployment);
	return getDeploymentTriggerLabel(deployment.trigger);
}

/**
 * The trigger line of a Riwayat row. Riwayat had no trigger before, so a personal workspace still
 * shows none, except for a rollback, which a reader has to tell apart from a new version.
 */
export function getHistoryTriggerNote(
	deployment: TriggerDeployment,
	workspaceType: WorkspaceType | null | undefined
): string | null {
	if (workspaceType === 'team' || deployment.trigger === DEPLOYMENT_TRIGGERS.rollback) {
		return describeDeploymentTrigger(deployment, workspaceType);
	}
	return null;
}
