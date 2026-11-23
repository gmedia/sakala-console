import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { resolveRoute } from '$app/paths';
import { getErrorMessage } from '$lib/api/errors';
import { createRedeployMutation, createUpdateProjectMutation } from '../mutations';
import { getDeployErrorMessage, REDEPLOY_COPY } from '../presentation';
import type { Project, RedeployOptions } from '../type';
import { getProjectDetailContext } from './projectDetailState.svelte';
import { executeRedeployFlow, redeployStartedMessage } from './redeploy';

/**
 * Redeploy from a project tab: saves the settings draft first, then opens the new deployment, which
 * is both the confirmation and the place to follow it.
 */
export function useProjectRedeploy(project: () => Pick<Project, 'id' | 'branch'>) {
	const detailState = getProjectDetailContext();
	const redeploy = createRedeployMutation();
	const updateProjectMutation = createUpdateProjectMutation();

	let errorMessage = $state('');
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let submitting = false;

	const isProcessing = $derived(redeploy.isPending || updateProjectMutation.isPending);

	async function trigger({ forceBuild = false }: RedeployOptions = {}) {
		if (submitting || isProcessing) return;

		submitting = true;
		errorMessage = '';
		const current = project();

		try {
			await executeRedeployFlow({
				project: current,
				detailState,
				forceBuild,
				updateProject: (payload) => updateProjectMutation.mutateAsync(payload),
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
		} catch (error) {
			errorMessage = getErrorMessage(
				error,
				'Perubahan pengaturan belum tersimpan, jadi redeploy tidak dijalankan. Periksa isian di tab Pengaturan, lalu tekan Redeploy lagi.'
			);
			submitting = false;
		}
	}

	return {
		trigger,
		get isProcessing() {
			return isProcessing;
		},
		get errorMessage() {
			return errorMessage;
		}
	};
}
