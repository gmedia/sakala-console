import type { Workspace, WorkspaceSummary } from '$lib/api/resources/workspaces';
import { useCurrentUser } from '$lib/features/auth/queries';
import { canManageProjects, canManageWorkspace } from './presentation';
import { createWorkspacesQuery } from './queries';
import { resolveActiveWorkspace, workspaceSelection } from './selection.svelte';

/**
 * The workspaces the user belongs to and the one they are working in. The personal workspace is
 * the default, so someone without a team sees what they saw before teams existed.
 */
export function useActiveWorkspace() {
	const userQuery = useCurrentUser();
	const workspacesQuery = createWorkspacesQuery();

	const userId = $derived(userQuery.data?.id);
	const workspaces = $derived(workspacesQuery.data ?? []);
	const active = $derived(resolveActiveWorkspace(workspaces, workspaceSelection.get(userId)));

	return {
		get workspaces(): Workspace[] {
			return workspaces;
		},
		get active(): Workspace | null {
			return active;
		},
		get hasTeams(): boolean {
			return workspaces.some((workspace) => workspace.type === 'team');
		},
		/** Settled either way: loaded, or failed so callers stop waiting and fall back. */
		get isSettled(): boolean {
			return workspacesQuery.isSuccess || workspacesQuery.isError;
		},
		get isError(): boolean {
			return workspacesQuery.isError;
		},
		select(workspaceId: string) {
			workspaceSelection.select(userId, workspaceId);
		}
	};
}

/**
 * What the user may do with a project, from the role in its workspace. The project resource does
 * not carry the role, so it comes from the workspace list. The API stays the authority: this only
 * keeps controls a viewer cannot use off the screen.
 */
export function useProjectAccess(
	project: () => { workspace?: WorkspaceSummary | null } | null | undefined
) {
	const workspacesQuery = createWorkspacesQuery();

	const summary = $derived(project()?.workspace ?? null);
	const membership = $derived(
		summary ? workspacesQuery.data?.find((workspace) => workspace.id === summary.id) : undefined
	);
	const role = $derived(membership?.role ?? null);
	// An API without workspaces, or a project in the personal workspace, is the user's own. A team
	// project waits for the role, so a viewer never sees a control flash on and off.
	const readOnly = $derived.by(() => {
		if (!summary || summary.type === 'personal') return false;
		if (workspacesQuery.isError) return false;
		return !canManageProjects(role);
	});

	return {
		get workspace() {
			return summary;
		},
		get role() {
			return role;
		},
		get readOnly() {
			return readOnly;
		},
		get canManageWorkspace() {
			return canManageWorkspace(role);
		},
		get hasTeams() {
			return workspacesQuery.data?.some((workspace) => workspace.type === 'team') ?? false;
		}
	};
}
