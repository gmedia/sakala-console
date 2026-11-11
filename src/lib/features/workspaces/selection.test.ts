import { describe, expect, it } from 'vitest';
import type { Workspace } from '$lib/api/resources/workspaces';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import { parseWorkspaceList } from '$lib/api/resources/workspaces';
import {
	createWorkspaceSelection,
	readStoredWorkspaceId,
	resolveActiveWorkspace,
	selectionStorageKey,
	writeStoredWorkspaceId,
	type SelectionStorage
} from './selection.svelte';

function memoryStorage(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key)
	} satisfies SelectionStorage & { data: Map<string, string> };
}

const refusing: SelectionStorage = {
	getItem: () => {
		throw new Error('SecurityError');
	},
	setItem: () => {
		throw new Error('QuotaExceededError');
	},
	removeItem: () => {
		throw new Error('SecurityError');
	}
};

const workspaces: Workspace[] = parseWorkspaceList(getWorkspaceFixture('workspaces').body);
const [personal, team] = workspaces;

describe('resolveActiveWorkspace', () => {
	it('defaults to the personal workspace, so someone without a choice sees what they saw before', () => {
		expect(resolveActiveWorkspace(workspaces, null)).toEqual(personal);
	});

	it('keeps the remembered workspace while the user belongs to it', () => {
		expect(resolveActiveWorkspace(workspaces, team.id)).toEqual(team);
	});

	it('falls back to the personal workspace for a team the user left or that was deleted', () => {
		expect(resolveActiveWorkspace(workspaces, 'gone')).toEqual(personal);
	});

	it('has nothing to resolve before the list arrives', () => {
		expect(resolveActiveWorkspace([], team.id)).toBeNull();
	});
});

describe('stored selection', () => {
	it('is kept per user, so a shared browser does not hand one person’s team to another', () => {
		const storage = memoryStorage();
		writeStoredWorkspaceId(storage, 1, team.id);

		expect(storage.data.get(selectionStorageKey(1))).toBe(team.id);
		expect(readStoredWorkspaceId(storage, 1)).toBe(team.id);
		expect(readStoredWorkspaceId(storage, 2)).toBeNull();
	});

	it('forgets the choice when cleared', () => {
		const storage = memoryStorage({ [selectionStorageKey(1)]: team.id });
		writeStoredWorkspaceId(storage, 1, null);
		expect(readStoredWorkspaceId(storage, 1)).toBeNull();
	});

	it('survives storage that is missing or refuses access', () => {
		expect(readStoredWorkspaceId(null, 1)).toBeNull();
		expect(readStoredWorkspaceId(refusing, 1)).toBeNull();
		expect(() => writeStoredWorkspaceId(refusing, 1, team.id)).not.toThrow();
	});
});

describe('createWorkspaceSelection', () => {
	it('reads what an earlier visit remembered', () => {
		const storage = memoryStorage({ [selectionStorageKey(7)]: team.id });
		const selection = createWorkspaceSelection(() => storage);
		expect(selection.get(7)).toBe(team.id);
	});

	it('remembers a choice for the next visit', () => {
		const storage = memoryStorage();
		createWorkspaceSelection(() => storage).select(7, team.id);

		expect(createWorkspaceSelection(() => storage).get(7)).toBe(team.id);
	});

	it('keeps the choice for this tab when storage refuses it', () => {
		const selection = createWorkspaceSelection(() => refusing);
		selection.select(7, team.id);
		expect(selection.get(7)).toBe(team.id);
	});

	it('does nothing before the user is known', () => {
		const storage = memoryStorage();
		const selection = createWorkspaceSelection(() => storage);
		selection.select(undefined, team.id);
		expect(selection.get(undefined)).toBeNull();
		expect(storage.data.size).toBe(0);
	});
});
