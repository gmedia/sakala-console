import { goto } from '$app/navigation';
import { resolveRoute } from '$app/paths';
import { getErrorMessage } from '$lib/api/errors';
import { executeRedeployFlow } from '$lib/features/projects/detail/redeploy';
import { createRedeployMutation } from '$lib/features/projects/mutations';

const REDEPLOY_FALLBACK_ERROR = 'Redeploy belum berhasil dijalankan. Silakan coba lagi.';

/**
 * Redeploys from the deployment detail page. The API requires the project's current branch, which
 * can differ from the branch this deployment ran on, so the branch comes from the project.
 */
export function useFailedDeploymentRedeploy(project: () => { id: string; branch?: string } | null) {
	const redeploy = createRedeployMutation();
	let errorMessage = $state('');
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	async function trigger() {
		const current = project();
		if (!current || submitting) return;

		submitting = true;
		errorMessage = '';

		await executeRedeployFlow({
			project: current,
			updateProject: () => Promise.resolve(),
			triggerRedeploy: (payload) => {
				redeploy.mutate(payload, {
					onSuccess: (deployment) => {
						void goto(
							resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
								id: current.id,
								deploymentId: deployment.id
							})
						);
					},
					onError: (error) => {
						errorMessage = getErrorMessage(error, REDEPLOY_FALLBACK_ERROR);
					},
					onSettled: () => {
						submitting = false;
					}
				});
			}
		});
	}

	return {
		trigger,
		get isPending() {
			return redeploy.isPending;
		},
		get isReady() {
			return project() !== null;
		},
		get errorMessage() {
			return errorMessage;
		}
	};
}
