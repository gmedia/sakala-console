import { describe, expect, it } from 'vitest';
import { hashKey, partialMatchKey } from '@tanstack/svelte-query';
import { queryKeys } from './query-keys';

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
