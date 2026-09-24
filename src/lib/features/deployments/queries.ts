import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getDeployment, getDeploymentEvents } from '$lib/api/resources/deployment';
import { TERMINAL_STATUSES } from './deployment-presentation';
import { realtimeState } from '$lib/realtime/connection-state.svelte';

export const REALTIME_CONNECTED_SAFETY_POLL_MS = 10_000;
export const FALLBACK_POLLING_INTERVAL_MS = 5_000;

export function resolveRefetchInterval(isTerminalStatus: boolean): number | false {
	if (isTerminalStatus) return false;
	return realtimeState.status === 'connected'
		? REALTIME_CONNECTED_SAFETY_POLL_MS
		: FALLBACK_POLLING_INTERVAL_MS;
}

export function createDeploymentQuery(projectId: () => string, deploymentId: () => string) {
	return createQuery(() => {
		const project = projectId();
		const deployment = deploymentId();

		return {
			queryKey: queryKeys.deployments.detail(project, deployment),
			queryFn: () => getDeployment(project, deployment),
			refetchInterval: (query) => {
				const status = query.state.data?.data.status;
				return resolveRefetchInterval(!!status && TERMINAL_STATUSES.has(status));
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
			refetchInterval: () => resolveRefetchInterval(isTerminal()),
			enabled: !!project && !!deployment
		};
	});
}
