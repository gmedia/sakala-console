import type { WorkspaceRole } from '$lib/api/resources/workspaces';
import { databaseAccess, type DatabaseAccess } from '$lib/features/databases/access';

/**
 * What the user may do with a workspace's buckets. sakala-api's ManagedBucketPolicy uses the same
 * roles as databases: every member reads, owners and members change, only owners (and admins) read
 * the secret key. The API stays the authority.
 */
export type BucketAccess = DatabaseAccess;

export function bucketAccess(
	role: WorkspaceRole | null | undefined,
	isSiteAdmin: boolean
): BucketAccess {
	return databaseAccess(role, isSiteAdmin);
}
