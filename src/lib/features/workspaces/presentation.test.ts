import { describe, expect, it } from 'vitest';
import { NetworkError } from '$lib/api/errors';
import { parseMemberList } from '$lib/api/resources/workspaces';
import { errorFromFixture, getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import {
	INVITATION_PROBLEM_COPY,
	LAST_OWNER_LEAVE_REASON,
	LAST_OWNER_REASON,
	canManageProjects,
	canManageWorkspace,
	deleteGuard,
	invitationProblem,
	leaveGuard,
	limitsWorkspaceId,
	memberGuard,
	workspaceErrorMessage,
	workspaceLabel
} from './presentation';

const members = parseMemberList(getWorkspaceFixture('members').body);
const [owner, member, viewer] = members;

describe('roles', () => {
	it('lets owners and members manage projects, and only owners the workspace', () => {
		expect([canManageProjects('owner'), canManageProjects('member')]).toEqual([true, true]);
		expect(canManageProjects('viewer')).toBe(false);
		expect(canManageProjects(null)).toBe(false);
		expect([canManageWorkspace('owner'), canManageWorkspace('member')]).toEqual([true, false]);
	});
});

describe('last owner', () => {
	it('protects the only owner from demotion and removal', () => {
		expect(memberGuard(owner, members)).toEqual({ isLastOwner: true, reason: LAST_OWNER_REASON });
		expect(memberGuard(member, members).isLastOwner).toBe(false);
		expect(memberGuard(viewer, members).isLastOwner).toBe(false);
	});

	it('lifts the protection once there is a second owner', () => {
		const twoOwners = members.map((item) =>
			item === member ? { ...item, role: 'owner' as const } : item
		);
		expect(memberGuard(owner, twoOwners).isLastOwner).toBe(false);
	});

	it('stops the only owner from leaving, but not anyone else', () => {
		expect(leaveGuard('owner', members)).toBe(LAST_OWNER_LEAVE_REASON);
		expect(leaveGuard('member', members)).toBeNull();
		expect(leaveGuard('viewer', members)).toBeNull();
	});
});

describe('deleteGuard', () => {
	it('explains that a workspace with projects cannot be deleted', () => {
		expect(deleteGuard(2)).toMatch(/masih punya 2 proyek/);
		expect(deleteGuard(0)).toBeNull();
		expect(deleteGuard(undefined)).toBeNull();
	});
});

describe('labels and parameters', () => {
	it('labels the personal workspace by what it is, not by the owner’s name', () => {
		expect(workspaceLabel({ name: 'Rani Putri', type: 'personal' })).toBe('Pribadi');
		expect(workspaceLabel({ name: 'Tim Facility', type: 'team' })).toBe('Tim Facility');
	});

	it('asks for the personal workspace’s limits without a parameter', () => {
		expect(limitsWorkspaceId({ id: 'p', type: 'personal' })).toBeNull();
		expect(limitsWorkspaceId({ id: 't', type: 'team' })).toBe('t');
		expect(limitsWorkspaceId(null)).toBeNull();
	});
});

describe('workspaceErrorMessage', () => {
	it('explains the owned-team cap with the API’s numbers', () => {
		expect(workspaceErrorMessage(errorFromFixture('workspace-create-cap'), 'x')).toMatch(
			/sudah memiliki 2 workspace tim/
		);
	});

	it.each(['member-update-last-owner', 'member-remove-last-owner', 'leave-last-owner'])(
		'explains %s as the last-owner rule',
		(name) => {
			expect(workspaceErrorMessage(errorFromFixture(name), 'x')).toMatch(
				/harus selalu punya pemilik/
			);
		}
	);

	it('explains why a workspace with projects is not deleted', () => {
		expect(workspaceErrorMessage(errorFromFixture('workspace-delete-not-empty'), 'x')).toMatch(
			/masih punya proyek/
		);
	});

	it('explains a 403 as missing permission', () => {
		expect(workspaceErrorMessage(errorFromFixture('member-update-forbidden'), 'x')).toMatch(
			/Hanya pemilik workspace/
		);
	});

	it('falls back for a network failure', () => {
		expect(workspaceErrorMessage(new NetworkError(), 'Gagal.')).toBe(
			'Sakala API tidak dapat dijangkau.'
		);
	});
});

describe('invitationProblem', () => {
	it.each([
		['invitation-accept-expired', 'expired'],
		['invitation-accept-revoked', 'not_found'],
		['invitation-accept-email-mismatch', 'email_mismatch'],
		['invitation-accept-already-member', 'already_member']
	] as const)('reads %s as %s', (name, problem) => {
		expect(invitationProblem(errorFromFixture(name))).toBe(problem);
	});

	it('names every reason a link can stop working when the API only says 404', () => {
		expect(INVITATION_PROBLEM_COPY.not_found.message).toMatch(/dibatalkan/);
		expect(INVITATION_PROBLEM_COPY.not_found.message).toMatch(/sudah dipakai/);
	});

	it('treats anything else as a generic problem', () => {
		expect(invitationProblem(new Error('boom'))).toBe('other');
	});
});
