import type { WorkspaceRole } from '$lib/api/resources/workspaces';
import { databaseAccess, type DatabaseAccess } from '$lib/features/databases/access';

/**
 * What the user may do with a workspace's Valkey stores. sakala-api's ManagedValkeyPolicy uses the
 * same roles as databases and buckets: every member reads, owners and members change, only owners
 * (and admins) read the password. The API stays the authority.
 */
export type ValkeyAccess = DatabaseAccess;

export function valkeyAccess(
	role: WorkspaceRole | null | undefined,
	isSiteAdmin: boolean
): ValkeyAccess {
	return databaseAccess(role, isSiteAdmin);
}
