import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { ApiError } from '$lib/api/errors';
import { cancelDeployment, rollbackDeployment } from '$lib/api/resources/deployment';
import { projectKeys } from '$lib/features/projects/queries';

export function createCancelDeploymentMutation(
	projectId: () => string,
	deploymentId: () => string
) {
	const client = useQueryClient();

	return createMutation(() => ({
		mutationFn: () => cancelDeployment(projectId(), deploymentId()),
		onSuccess: (response) => {
			client.setQueryData(queryKeys.deployments.detail(projectId(), deploymentId()), response);
		},
		onSettled: () => {
			// Also on a 409: it means the deployment finished, and this page has not heard yet.
			void client.invalidateQueries({
				queryKey: queryKeys.deployments.detail(projectId(), deploymentId())
			});
			void client.invalidateQueries({
				queryKey: queryKeys.deployments.events(projectId(), deploymentId())
			});
			void client.invalidateQueries({ queryKey: projectKeys.deployments(projectId()) });
			void client.invalidateQueries({ queryKey: projectKeys.detail(projectId()), exact: true });
		}
	}));
}

/**
 * Starts a rollback to `deploymentId`. The new deployment is cached for the page that opens next.
 * The project changes too (auto-deploy pauses), and a coded refusal means the history on screen is
 * out of date, so both are read again either way.
 */
export function createRollbackMutation(projectId: () => string) {
	const client = useQueryClient();

	function refresh(project: string) {
		void client.invalidateQueries({ queryKey: projectKeys.deployments(project) });
		void client.invalidateQueries({ queryKey: projectKeys.detail(project), exact: true });
	}

	return createMutation(() => ({
		mutationFn: (variables: { deploymentId: string; idempotencyKey: string }) =>
			rollbackDeployment(projectId(), variables.deploymentId, variables.idempotencyKey),
		onSuccess: (response) => {
			const project = projectId();
			client.setQueryData(queryKeys.deployments.detail(project, response.data.id), response);
			refresh(project);
			void client.invalidateQueries({ queryKey: queryKeys.pilotLimits });
		},
		onError: (error) => {
			if (error instanceof ApiError && error.code) refresh(projectId());
		}
	}));
}
