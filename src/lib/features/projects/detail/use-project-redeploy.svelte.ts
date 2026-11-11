import { goto } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { resolveRoute } from '$app/paths';
import { getErrorMessage } from '$lib/api/errors';
import { createRedeployMutation, createUpdateProjectMutation } from '../mutations';
import type { Project } from '../type';
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

	async function trigger() {
		if (submitting || isProcessing) return;

		submitting = true;
		errorMessage = '';
		const current = project();

		try {
			await executeRedeployFlow({
				project: current,
				detailState,
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
							errorMessage = getErrorMessage(
								error,
								'Redeploy belum berhasil dijalankan. Silakan coba lagi.'
							);
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
				'Perubahan pengaturan belum tersimpan, jadi redeploy tidak dijalankan. Silakan coba lagi.'
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
