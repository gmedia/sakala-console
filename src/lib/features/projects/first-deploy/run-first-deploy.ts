import { ApiError } from '$lib/api/errors';
import type { EnvSaveFailure, WizardEnvVar } from '../create/createProjectState.svelte';
import { DATABASE_OPTIONS } from './database-choice';

/**
 * What "Deploy sekarang" does after the Persiapan phase, in this order:
 *
 * 1. Save the release command (PATCH the project), when one was suggested and kept.
 * 2. Save the variables one by one; a refusal stops here so the user can fix or drop it.
 * 3. Database: a new one is created for the project with `deploy_when_ready`, and the API starts
 *    the deployment once it is ready, so the wizard waits. An existing one is attached, then
 *    deployed. None: deployed at once.
 *
 * Steps that succeeded are remembered, so a retry after a failure does not repeat them (a second
 * POST would create a second variable or database).
 */

export const FIRST_DEPLOY_STEPS = {
	releaseCommand: 'release-command',
	variables: 'variables',
	database: 'database',
	deploy: 'deploy'
} as const;

export type FirstDeployStep = (typeof FIRST_DEPLOY_STEPS)[keyof typeof FIRST_DEPLOY_STEPS];

export type FirstDeployDatabase =
	| { kind: typeof DATABASE_OPTIONS.create }
	| { kind: typeof DATABASE_OPTIONS.attach; databaseId: string }
	| { kind: typeof DATABASE_OPTIONS.none };

export type FirstDeployPlan = {
	/** `null` leaves the project's release command as it is. */
	releaseCommand: string | null;
	envVars: readonly WizardEnvVar[];
	database: FirstDeployDatabase;
};

export type FirstDeployEffects = {
	saveReleaseCommand: (command: string) => Promise<unknown>;
	/** Resolves with the variables that were refused; rejects only when nothing can succeed. */
	saveVariables: (envVars: readonly WizardEnvVar[]) => Promise<EnvSaveFailure[]>;
	createDatabase: () => Promise<unknown>;
	attachDatabase: (databaseId: string) => Promise<unknown>;
	deploy: () => Promise<{ id: string }>;
};

export type FirstDeployOutcome =
	| { kind: 'deployed'; deploymentId: string }
	| { kind: 'waiting-for-database' }
	| { kind: 'variables-failed'; failures: EnvSaveFailure[] }
	| { kind: 'failed'; step: FirstDeployStep; error: unknown };

export type FirstDeployResult = {
	outcome: FirstDeployOutcome;
	/** Every step done so far, including earlier runs. */
	done: ReadonlySet<FirstDeployStep>;
};

export const NO_STEPS_DONE: ReadonlySet<FirstDeployStep> = new Set();

/** A step the user chose to skip, such as refused variables they went on without. */
export function withStepDone(
	done: ReadonlySet<FirstDeployStep>,
	step: FirstDeployStep
): ReadonlySet<FirstDeployStep> {
	return new Set([...done, step]);
}

/** The steps a plan needs, in order. A new database hands the deploy over to the API. */
export function firstDeploySteps(plan: FirstDeployPlan): FirstDeployStep[] {
	const steps: FirstDeployStep[] = [];
	if (plan.releaseCommand !== null) steps.push(FIRST_DEPLOY_STEPS.releaseCommand);
	if (plan.envVars.length > 0) steps.push(FIRST_DEPLOY_STEPS.variables);
	if (plan.database.kind !== DATABASE_OPTIONS.none) steps.push(FIRST_DEPLOY_STEPS.database);
	if (plan.database.kind !== DATABASE_OPTIONS.create) steps.push(FIRST_DEPLOY_STEPS.deploy);
	return steps;
}

async function runStep(
	step: FirstDeployStep,
	plan: FirstDeployPlan,
	effects: FirstDeployEffects
): Promise<FirstDeployOutcome | null> {
	switch (step) {
		case FIRST_DEPLOY_STEPS.releaseCommand:
			await effects.saveReleaseCommand(plan.releaseCommand ?? '');
			return null;
		case FIRST_DEPLOY_STEPS.variables: {
			const failures = await effects.saveVariables(plan.envVars);
			return failures.length > 0 ? { kind: 'variables-failed', failures } : null;
		}
		case FIRST_DEPLOY_STEPS.database:
			if (plan.database.kind === DATABASE_OPTIONS.create) {
				await effects.createDatabase();
				return { kind: 'waiting-for-database' };
			}
			if (plan.database.kind === DATABASE_OPTIONS.attach) {
				await effects.attachDatabase(plan.database.databaseId);
			}
			return null;
		case FIRST_DEPLOY_STEPS.deploy: {
			const deployment = await effects.deploy();
			return { kind: 'deployed', deploymentId: deployment.id };
		}
	}
}

export async function runFirstDeploy(
	plan: FirstDeployPlan,
	alreadyDone: ReadonlySet<FirstDeployStep>,
	effects: FirstDeployEffects
): Promise<FirstDeployResult> {
	const done = new Set(alreadyDone);

	for (const step of firstDeploySteps(plan)) {
		if (done.has(step)) continue;
		try {
			const outcome = await runStep(step, plan, effects);
			if (outcome?.kind === 'variables-failed') return { outcome, done };
			done.add(step);
			if (outcome) return { outcome, done };
		} catch (error) {
			// The session is gone and the login redirect is on its way; nothing else can succeed.
			if (error instanceof ApiError && error.isUnauthenticated) throw error;
			return { outcome: { kind: 'failed', step, error }, done };
		}
	}

	// Only a new database gets here: its last step hands the deploy to the API, so a run after it
	// has nothing left to do but wait. Every other plan ends with the deploy, which returns above.
	return { outcome: { kind: 'waiting-for-database' }, done };
}
