import { createQuery } from '@tanstack/svelte-query';
import { getProjectMetrics, type ProjectMetricsRange } from '$lib/api/resources/project-metrics';
import { rateLimitWait } from '$lib/api/rate-limit';
import { realtimeState } from '$lib/realtime/connection-state.svelte';
import { projectKeys } from '../queries';
import { getDeploymentsSince, markerFilterFor } from './deployment-markers';
import { metricsRangeOption, resolveMetricsPollInterval } from './ranges';

export const projectMetricsKey = (projectId: string, range: ProjectMetricsRange) =>
	[...projectKeys.detail(projectId), 'metrics', range] as const;

/**
 * One read per range. It polls only while the project runs and the range is short enough to gain a
 * bucket in a minute; TanStack Query pauses the interval while the tab is hidden
 * (`refetchIntervalInBackground` stays off).
 */
/** Under `projectKeys.deployments`, so the realtime refresh that follows a deployment re-reads it. */
export const deploymentMarkersKey = (projectId: string, range: ProjectMetricsRange) =>
	[...projectKeys.deployments(projectId), 'markers', range] as const;

/**
 * With the socket up, a finished deployment refreshes `projectKeys.deployments`, which covers the
 * markers. Without it, they keep pace with the charts, so a new line never trails its data.
 */
export function resolveMarkersPollInterval(
	range: ProjectMetricsRange,
	runtimeStatus: string | undefined,
	error?: unknown
): number | false {
	const wait = rateLimitWait(error);
	if (wait !== undefined) return wait;
	if (realtimeState.status === 'connected') return false;
	return resolveMetricsPollInterval(range, runtimeStatus);
}

/** The deployments behind the charts' markers: those created since the window opened. */
export function createDeploymentMarkersQuery(
	projectId: () => string,
	range: () => ProjectMetricsRange,
	runtimeStatus: () => string | undefined,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = projectId();
		const { enabled = true } = options();
		const currentRange = range();
		const status = runtimeStatus();
		const option = metricsRangeOption(currentRange);
		return {
			queryKey: deploymentMarkersKey(id, currentRange),
			queryFn: () =>
				getDeploymentsSince(
					id,
					Math.floor(Date.now() / 1_000) - option.seconds,
					markerFilterFor(option)
				),
			enabled: !!id && enabled,
			// The charts read fine without the markers, so a failure is not worth a second request.
			retry: false,
			refetchInterval: (query: { state: { error: unknown } }) =>
				resolveMarkersPollInterval(currentRange, status, query.state.error)
		};
	});
}

export function createProjectMetricsQuery(
	projectId: () => string,
	range: () => ProjectMetricsRange,
	runtimeStatus: () => string | undefined,
	options: () => { enabled?: boolean } = () => ({})
) {
	return createQuery(() => {
		const id = projectId();
		const { enabled = true } = options();
		const currentRange = range();
		// Read here, not in the callback, so a project waking up re-arms the interval.
		const status = runtimeStatus();
		return {
			queryKey: projectMetricsKey(id, currentRange),
			queryFn: () => getProjectMetrics(id, currentRange),
			enabled: !!id && enabled,
			refetchInterval: (query: { state: { error: unknown } }) =>
				resolveMetricsPollInterval(currentRange, status, query.state.error)
		};
	});
}
