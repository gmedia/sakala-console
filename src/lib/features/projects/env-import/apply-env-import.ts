import { ApiError, getErrorMessage } from '$lib/api/errors';
import type { EnvImportPlan, PlannedEnvVar } from './plan-env-import';

export type EnvImportFailure = { key: string; message: string };

type ApplyEnvImportOptions = {
	add: (env: PlannedEnvVar) => Promise<unknown>;
	overwrite: (env: PlannedEnvVar) => Promise<unknown>;
};

/**
 * Saves a pasted .env one variable at a time, the same as the wizard does, so one refusal does
 * not lose the others. The API has no bulk endpoint yet.
 */
export async function applyEnvImport(
	plan: EnvImportPlan,
	{ add, overwrite }: ApplyEnvImportOptions
): Promise<{ saved: number; failures: EnvImportFailure[] }> {
	const failures: EnvImportFailure[] = [];
	let saved = 0;
	const steps = [
		...plan.toAdd.map((env) => () => add(env).then(() => env)),
		...plan.toOverwrite.map((env) => () => overwrite(env).then(() => env))
	];
	const keys = [...plan.toAdd, ...plan.toOverwrite].map((env) => env.key);

	for (const [index, step] of steps.entries()) {
		try {
			await step();
			saved += 1;
		} catch (error) {
			// The session is gone and the login redirect is on its way; nothing else can succeed.
			if (error instanceof ApiError && error.isUnauthenticated) throw error;
			failures.push({
				key: keys[index],
				message: getErrorMessage(error, `Variabel ${keys[index]} belum tersimpan.`)
			});
		}
	}

	return { saved, failures };
}
