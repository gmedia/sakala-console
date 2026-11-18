import { createQuery } from '@tanstack/svelte-query';
import { getProjectMetrics, type ProjectMetricsRange } from '$lib/api/resources/project-metrics';
import { projectKeys } from '../queries';
import { resolveMetricsPollInterval } from './ranges';

export const projectMetricsKey = (projectId: string, range: ProjectMetricsRange) =>
	[...projectKeys.detail(projectId), 'metrics', range] as const;

/**
 * One read per range. It polls only while the project runs and the range is short enough to gain a
 * bucket in a minute; TanStack Query pauses the interval while the tab is hidden
 * (`refetchIntervalInBackground` stays off).
 */
export function createProjectMetricsQuery(
	projectId: () => string,
	range: () => ProjectMetricsRange,
	runtimeStatus: () => string | undefined
) {
	return createQuery(() => {
		const id = projectId();
		const currentRange = range();
		// Read here, not in the callback, so a project waking up re-arms the interval.
		const status = runtimeStatus();
		return {
			queryKey: projectMetricsKey(id, currentRange),
			queryFn: () => getProjectMetrics(id, currentRange),
			enabled: !!id,
			refetchInterval: (query: { state: { error: unknown } }) =>
				resolveMetricsPollInterval(currentRange, status, query.state.error)
		};
	});
}
