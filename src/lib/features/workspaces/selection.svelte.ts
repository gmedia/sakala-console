import type { Workspace } from '$lib/api/resources/workspaces';

export type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const STORAGE_PREFIX = 'sakala.active-workspace';

/** Per user as well as per browser, so a shared laptop does not carry one person's team to another. */
export function selectionStorageKey(userId: number | string): string {
	return `${STORAGE_PREFIX}.${userId}`;
}

/** Storage can be missing or refuse access (private mode, blocked cookies); that only loses the memory. */
export function readStoredWorkspaceId(
	storage: SelectionStorage | null,
	userId: number | string
): string | null {
	try {
		return storage?.getItem(selectionStorageKey(userId)) || null;
	} catch {
		return null;
	}
}

export function writeStoredWorkspaceId(
	storage: SelectionStorage | null,
	userId: number | string,
	workspaceId: string | null
): void {
	try {
		if (workspaceId) storage?.setItem(selectionStorageKey(userId), workspaceId);
		else storage?.removeItem(selectionStorageKey(userId));
	} catch {
		// Remembering is a convenience; the choice still holds for this tab.
	}
}

/**
 * The remembered workspace while the user still belongs to it, otherwise the personal one. A team
 * the user left, was removed from, or deleted falls back without a trace.
 */
export function resolveActiveWorkspace(
	workspaces: readonly Workspace[],
	preferredId: string | null
): Workspace | null {
	return (
		(preferredId ? workspaces.find((workspace) => workspace.id === preferredId) : undefined) ??
		workspaces.find((workspace) => workspace.type === 'personal') ??
		workspaces[0] ??
		null
	);
}

function browserStorage(): SelectionStorage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/** The chosen workspace per user, read from storage once and kept reactive. */
export function createWorkspaceSelection(
	getStorage: () => SelectionStorage | null = browserStorage
) {
	let version = $state(0);
	// A plain cache, filled while a $derived reads it, where writing reactive state is not allowed.
	// `version` is what makes a choice reactive.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const chosen = new Map<number | string, string | null>();

	return {
		get(userId: number | string | undefined): string | null {
			void version;
			if (userId === undefined) return null;
			if (!chosen.has(userId)) chosen.set(userId, readStoredWorkspaceId(getStorage(), userId));
			return chosen.get(userId) ?? null;
		},
		select(userId: number | string | undefined, workspaceId: string | null): void {
			if (userId === undefined) return;
			chosen.set(userId, workspaceId);
			writeStoredWorkspaceId(getStorage(), userId, workspaceId);
			version += 1;
		}
	};
}

export const workspaceSelection = createWorkspaceSelection();
