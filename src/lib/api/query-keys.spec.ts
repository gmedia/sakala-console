import { describe, expect, it } from 'vitest';
import { hashKey, partialMatchKey } from '@tanstack/svelte-query';
import { queryKeys, workspaceIdOfQueryKey } from './query-keys';

describe('workspace query keys', () => {
	it('start with `workspaces`, so one invalidation covers the list, members, and invitations', () => {
		const all = queryKeys.workspaces.all;
		for (const key of [
			queryKeys.workspaces.list,
			queryKeys.workspaces.members('w1'),
			queryKeys.workspaces.invitations('w1'),
			queryKeys.workspaces.myInvitations
		]) {
			expect(partialMatchKey(key, all)).toBe(true);
		}
	});

	it('keep each workspace apart', () => {
		expect(hashKey(queryKeys.workspaces.members('w1'))).not.toBe(
			hashKey(queryKeys.workspaces.members('w2'))
		);
		expect(hashKey(queryKeys.workspaces.limits('w1'))).not.toBe(
			hashKey(queryKeys.workspaces.limits(null))
		);
	});

	it('file limits under `pilot-limits`, so refreshing limits after a deploy reaches every workspace', () => {
		expect(partialMatchKey(queryKeys.workspaces.limits('w1'), queryKeys.pilotLimits)).toBe(true);
		expect(partialMatchKey(queryKeys.workspaces.limits(null), queryKeys.pilotLimits)).toBe(true);
	});

	it('name the personal workspace explicitly rather than with an empty id', () => {
		expect(queryKeys.workspaces.limits(null)).toEqual(['pilot-limits', 'personal']);
	});

	it('include the workspace in the project list key, so switching never shows another list', () => {
		expect(hashKey(queryKeys.projects.list({ page: 1, workspace_id: 'w1' } as never))).not.toBe(
			hashKey(queryKeys.projects.list({ page: 1, workspace_id: 'w2' } as never))
		);
	});
});

describe('workspaceIdOfQueryKey', () => {
	it.each([
		['members', queryKeys.workspaces.members('w1')],
		['invitations', queryKeys.workspaces.invitations('w1')],
		['limits', queryKeys.workspaces.limits('w1')],
		['a project list filtered to it', queryKeys.projects.list({ page: 1, workspace_id: 'w1' })]
	])('names the workspace of its %s', (_name, key) => {
		expect(workspaceIdOfQueryKey(key)).toBe('w1');
	});

	it.each([
		['the workspace list', queryKeys.workspaces.list],
		['my invitations', queryKeys.workspaces.myInvitations],
		['personal limits', queryKeys.workspaces.limits(null)],
		['the limits without a workspace', queryKeys.pilotLimits],
		['a project list across workspaces', queryKeys.projects.list({ page: 1 })],
		['a project', queryKeys.projects.detail('w1')],
		['a member read before the workspace is known', queryKeys.workspaces.members('')],
		['an invitation link', queryKeys.workspaceInvitation('w1', null)],
		['an admin workspace', queryKeys.admin.workspace('w1')]
	])('names no workspace for %s', (_name, key) => {
		expect(workspaceIdOfQueryKey(key)).toBeNull();
	});
});
