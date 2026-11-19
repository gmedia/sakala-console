import type { WorkspaceRole } from '$lib/api/resources/workspaces';
import { canManageProjects } from '$lib/features/workspaces/presentation';

/**
 * What the user may do with a workspace's databases, as the API's ManagedDatabasePolicy decides it:
 * every member reads, owners and members change, only owners read credentials. Admins may do all
 * of it. The API stays the authority; this only keeps controls someone cannot use off the screen.
 */
export type DatabaseAccess = { canManage: boolean; canViewCredentials: boolean };

export function databaseAccess(
	role: WorkspaceRole | null | undefined,
	isSiteAdmin: boolean
): DatabaseAccess {
	return {
		canManage: isSiteAdmin || canManageProjects(role),
		canViewCredentials: isSiteAdmin || role === 'owner'
	};
}
