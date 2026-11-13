import type { WorkspaceSummary } from '$lib/api/resources/workspaces';
import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';

/**
 * The idle window of the project's workspace, for the sleeping notice. Only read while the project
 * sleeps, and only for a workspace the user belongs to: an admin looking at someone else's personal
 * project would otherwise get their own personal limits. `undefined` until known.
 */
export function useProjectIdleWindow(
	project: () => { runtime_status: string; workspace?: WorkspaceSummary | null },
	isMember: () => boolean
) {
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project().workspace),
		() => ({ enabled: isMember() && project().runtime_status === 'sleeping' })
	);

	return {
		get minutes(): number | undefined {
			return limitsQuery.data?.project_idle_sleep_minutes;
		}
	};
}
