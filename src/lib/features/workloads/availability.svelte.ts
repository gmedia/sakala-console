import type { PilotLimits } from '$lib/api/resources/pilot-limits';
import type { WorkspaceSummary } from '$lib/api/resources/workspaces';
import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';

/** Whether the installation offers workers and schedules, from the limits it reports. */
export function workloadFlags(limits: PilotLimits | undefined): {
	workers: boolean;
	schedules: boolean;
} {
	return {
		workers: limits?.workers?.enabled === true,
		schedules: limits?.schedules?.enabled === true
	};
}

/**
 * Workers and schedules exist for a project only when its workspace's pilot limits say the
 * installation turned them on (`workers.enabled`, `schedules.enabled`). Until the limits arrive,
 * or when they cannot be read, both read as off: nothing new appears, as on an installation
 * without ADR-022. A 404 from the endpoints afterwards is handled by the sections themselves.
 */
export function useWorkloadAvailability(
	project: () => { workspace?: WorkspaceSummary | null } | null | undefined
) {
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project()?.workspace),
		() => ({ enabled: Boolean(project()) })
	);
	const flags = $derived(workloadFlags(limitsQuery.data));

	return {
		get limits(): PilotLimits | undefined {
			return limitsQuery.data;
		},
		/** Whether the limits have been read, or could not be: until then the flags are unknown. */
		get settled(): boolean {
			return limitsQuery.isSuccess || limitsQuery.isError;
		},
		get workers(): boolean {
			return flags.workers;
		},
		get schedules(): boolean {
			return flags.schedules;
		}
	};
}
