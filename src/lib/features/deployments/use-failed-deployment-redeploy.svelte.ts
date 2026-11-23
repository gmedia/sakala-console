import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { resolveRoute } from '$app/paths';
import {
	executeRedeployFlow,
	redeployStartedMessage
} from '$lib/features/projects/detail/redeploy';
import { createRedeployMutation } from '$lib/features/projects/mutations';
import { getDeployErrorMessage, REDEPLOY_COPY } from '$lib/features/projects/presentation';
import type { RedeployOptions } from '$lib/features/projects/type';

/**
 * Redeploys from the deployment detail page. The API requires the project's current branch, which
 * can differ from the branch this deployment ran on, so the branch comes from the project.
 */
export function useFailedDeploymentRedeploy(project: () => { id: string; branch?: string } | null) {
	const redeploy = createRedeployMutation();
	let errorMessage = $state('');
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	async function trigger({ forceBuild = false }: RedeployOptions = {}) {
		const current = project();
		if (!current || submitting) return;

		submitting = true;
		errorMessage = '';

		await executeRedeployFlow({
			project: current,
			forceBuild,
			updateProject: () => Promise.resolve(),
			triggerRedeploy: (payload) => {
				redeploy.mutate(payload, {
					onSuccess: (deployment) => {
						toast.success(redeployStartedMessage(deployment));
						void goto(
							resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
								id: current.id,
								deploymentId: deployment.id
							})
						);
					},
					onError: (error) => {
						errorMessage = getDeployErrorMessage(error, REDEPLOY_COPY.failed);
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
