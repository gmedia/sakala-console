import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { cancelDeployment } from '$lib/api/resources/deployment';
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
