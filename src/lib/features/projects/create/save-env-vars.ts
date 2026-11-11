import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
import type { EnvSaveFailure, WizardEnvVar } from './createProjectState.svelte';

type SaveEnvVarsOptions = {
	save: (env: WizardEnvVar) => Promise<unknown>;
	onSaved?: (env: WizardEnvVar) => void;
};

/**
 * Stores variables one at a time, so one refusal does not lose the others. The project already
 * exists at this point, so a failure here never recreates it: the caller retries only what is
 * returned.
 */
export async function saveEnvVars(
	envVars: readonly WizardEnvVar[],
	{ save, onSaved }: SaveEnvVarsOptions
): Promise<EnvSaveFailure[]> {
	const failures: EnvSaveFailure[] = [];

	for (const env of envVars) {
		try {
			await save(env);
			onSaved?.(env);
		} catch (error) {
			// The session is gone and the login redirect is on its way; nothing else can succeed.
			if (error instanceof ApiError && error.isUnauthenticated) throw error;
			failures.push({
				env,
				message: getErrorMessage(error, `Variabel ${env.key} belum tersimpan. Silakan coba lagi.`),
				keyError: getFieldError(error, 'key'),
				valueError: getFieldError(error, 'value')
			});
		}
	}

	return failures;
}

/**
 * A retry can follow a request whose response got lost: the variable is saved and a second POST
 * would answer 422. Whatever the API already has is not retried.
 */
export function withoutAlreadySaved(
	failures: readonly EnvSaveFailure[],
	existingKeys: readonly string[]
): EnvSaveFailure[] {
	return failures.filter((failure) => !existingKeys.includes(failure.env.key));
}
