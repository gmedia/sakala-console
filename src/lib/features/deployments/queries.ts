import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getDeployment, getDeploymentEvents } from '$lib/api/resources/deployment';
import { TERMINAL_STATUSES } from './deployment-presentation';
import { realtimeState } from '$lib/realtime/connection-state.svelte';

export function createDeploymentQuery(projectId: () => string, deploymentId: () => string) {
	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.detail(project, deployment),
			queryFn: () => getDeployment(project, deployment),
			refetchInterval: (query) => {
				const status = query.state.data?.data.status;
				if (status && TERMINAL_STATUSES.has(status)) return false;
				return realtimeState.status === 'connected' ? false : 5000;
			},
			enabled: !!project && !!deployment
		};
	});
}

export function createDeploymentEventsQuery(
	projectId: () => string,
	deploymentId: () => string,
	isTerminal: () => boolean
) {
	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.events(project, deployment),
			queryFn: () => getDeploymentEvents(project, deployment),
			refetchInterval: () => {
				if (isTerminal()) return false;
				return realtimeState.status === 'connected' ? false : 5000;
			},
			enabled: !!project && !!deployment
		};
	});
}
