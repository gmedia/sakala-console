import { describe, expect, it, vi } from 'vitest';
import { errorFromFixture, getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import { apiRequest } from '../client';
import { parseCreateProjectResponse, parseListProjectsResponse } from './projects';
import { parsePilotLimitsResponse } from './pilot-limits';
import {
	acceptWorkspaceInvitation,
	declineWorkspaceInvitation,
	getWorkspaceInvitation,
	parseInvitation,
	parseInvitationDetails,
	parseInvitationList,
	parseMember,
	parseMemberList,
	parseWorkspace,
	parseWorkspaceList
} from './workspaces';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));

describe('workspace resources, against responses captured from sakala-api', () => {
	it('reads the workspace list, the personal workspace first, with the caller role', () => {
		const workspaces = parseWorkspaceList(getWorkspaceFixture('workspaces').body);

		expect(workspaces.map((workspace) => [workspace.type, workspace.role])).toEqual([
			['personal', 'owner'],
			['team', 'owner'],
			['team', 'owner']
		]);
		expect(workspaces[1].limit_profile?.name).toBe('Magang GMEDIA');
		expect(workspaces[2].limit_profile).toBeNull();
	});

	it('reads project and active deployment counts', () => {
		const workspaces = parseWorkspaceList(getWorkspaceFixture('workspaces-counts').body);
		expect(
			workspaces.map((workspace) => [
				workspace.type,
				workspace.projects_count,
				workspace.active_deployments_count
			])
		).toEqual([
			['personal', 0, 0],
			['team', 2, 1]
		]);
	});

	it('reads a viewer membership', () => {
		const workspaces = parseWorkspaceList(getWorkspaceFixture('workspaces-viewer').body);
		expect(workspaces.find((workspace) => workspace.type === 'team')?.role).toBe('viewer');
	});

	it.each(['workspace-create', 'workspace-rename', 'workspace-show', 'invitation-accept'])(
		'reads the single workspace in %s',
		(name) => {
			expect(parseWorkspace(getWorkspaceFixture(name).body).type).toBe('team');
		}
	);

	it('reads members with emails for an owner and without them for a viewer', () => {
		const forOwner = parseMemberList(getWorkspaceFixture('members').body);
		const forViewer = parseMemberList(getWorkspaceFixture('members-viewer').body);

		expect(forOwner.map((member) => member.role)).toEqual(['owner', 'member', 'viewer']);
		expect(forOwner.every((member) => member.user.email)).toBe(true);
		expect(forViewer.some((member) => member.user.email !== undefined)).toBe(false);
	});

	it('reads the member a role change returns', () => {
		expect(parseMember(getWorkspaceFixture('member-update').body).role).toBe('member');
	});

	it('reads pending invitations, including one whose inviter is known', () => {
		const invitations = parseInvitationList(getWorkspaceFixture('invitations').body);
		expect(invitations.length).toBeGreaterThan(0);
		expect(invitations[0].workspace.name).toBe('Tim Facility');

		const mine = parseInvitationList(getWorkspaceFixture('invitations-mine').body);
		expect(mine).toHaveLength(1);
		expect(mine[0].invited_by?.name).toBe('Rani Putri');
	});

	it('reads the invitation a new invite returns, with the address lowercased by the API', () => {
		expect(parseInvitation(getWorkspaceFixture('invitation-create').body).email).toBe(
			'dewi@kampus.test'
		);
	});

	it('reads the owning workspace on project list, detail, and create responses', () => {
		const list = parseListProjectsResponse(getWorkspaceFixture('projects-team').body);
		expect(list.data[0].workspace).toMatchObject({ type: 'team', name: 'Tim Facility' });

		const all = parseListProjectsResponse(getWorkspaceFixture('projects-all').body);
		expect(new Set(all.data.map((project) => project.workspace?.type))).toEqual(
			new Set(['team', 'personal'])
		);

		const created = parseCreateProjectResponse(getWorkspaceFixture('project-create-team').body);
		expect(created.workspace?.type).toBe('team');
	});

	it('reads the limits of a team with a profile and of the personal workspace', () => {
		const team = parsePilotLimitsResponse(getWorkspaceFixture('pilot-limits-team').body);
		expect(team.limit_profile?.name).toBe('Magang GMEDIA');
		expect(team.quotas.max_projects_per_user).toBe(5);
		expect(team.quotas.max_active_containers).toBeTypeOf('number');

		const personal = parsePilotLimitsResponse(getWorkspaceFixture('pilot-limits-personal').body);
		expect(personal.limit_profile).toBeNull();
	});

	it.each([
		['workspace-create-cap', 422, 'TEAM_LIMIT_EXCEEDED'],
		['member-update-last-owner', 409, 'LAST_WORKSPACE_OWNER'],
		['member-remove-last-owner', 409, 'LAST_WORKSPACE_OWNER'],
		['leave-last-owner', 409, 'LAST_WORKSPACE_OWNER'],
		['workspace-delete-not-empty', 409, 'WORKSPACE_NOT_EMPTY'],
		['workspace-rename-personal', 409, 'WORKSPACE_IS_PERSONAL'],
		['invitation-accept-expired', 409, 'INVITATION_EXPIRED'],
		['invitation-accept-email-mismatch', 403, 'INVITATION_EMAIL_MISMATCH'],
		['invitation-accept-already-member', 409, 'ALREADY_WORKSPACE_MEMBER'],
		['invitation-create-member', 409, 'ALREADY_WORKSPACE_MEMBER']
	])('%s carries the stable code the console reads', (name, status, code) => {
		const fixture = getWorkspaceFixture(name);
		expect(fixture.status).toBe(status);
		const error = errorFromFixture(name);
		expect(error.code).toBe(code);
		// A business refusal keeps the API's message for people.
		expect(error.message).toBe((fixture.body as { message: string }).message);
	});

	it('reads an invitation through its link, without the invited address', () => {
		const details = parseInvitationDetails(getWorkspaceFixture('invitation-details').body);
		expect(details).toMatchObject({
			role: 'member',
			workspace: { name: 'Tim Facility' },
			invited_by: { name: 'Rani Putri' },
			restricted_to_invited_email: false,
			can_accept: true,
			accept_error_code: null
		});
		expect(JSON.stringify(getWorkspaceFixture('invitation-details').body)).not.toContain('@');
	});

	it.each([
		['invitation-details-owner-restricted', true, 'INVITATION_EMAIL_MISMATCH'],
		['invitation-details-already-member', false, 'ALREADY_WORKSPACE_MEMBER']
	] as const)('reads %s as one this account cannot accept', (name, restricted, code) => {
		const details = parseInvitationDetails(getWorkspaceFixture(name).body);
		expect(details.restricted_to_invited_email).toBe(restricted);
		expect(details.can_accept).toBe(false);
		expect(details.accept_error_code).toBe(code);
	});

	it.each([
		['invitation-details-accepted', 409, 'INVITATION_ALREADY_ACCEPTED'],
		['invitation-details-declined', 409, 'INVITATION_DECLINED'],
		['invitation-details-revoked', 409, 'INVITATION_REVOKED'],
		['invitation-details-expired', 409, 'INVITATION_EXPIRED'],
		['invitation-details-unverified', 403, 'EMAIL_VERIFICATION_REQUIRED'],
		['invitation-accept-already-accepted', 409, 'INVITATION_ALREADY_ACCEPTED'],
		['invitation-accept-revoked-token', 409, 'INVITATION_REVOKED']
	])('%s names why the link stopped working', (name, status, code) => {
		const fixture = getWorkspaceFixture(name);
		expect(fixture.status).toBe(status);
		expect(errorFromFixture(name).code).toBe(code);
	});

	it('a wrong token is a plain 404 without a code', () => {
		for (const name of ['invitation-accept-revoked', 'invitation-details-not-found']) {
			expect(getWorkspaceFixture(name).status).toBe(404);
			expect(errorFromFixture(name).code).toBeUndefined();
		}
	});

	it('a viewer is refused secret values and project creation with 403', () => {
		expect(getWorkspaceFixture('env-value-viewer').status).toBe(403);
		expect(getWorkspaceFixture('project-create-viewer').status).toBe(403);
	});
});

describe('invitation responses', () => {
	it('reads one invitation with the token, behind its own rate limit', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(getWorkspaceFixture('invitation-details').body);
		const details = await getWorkspaceInvitation('inv-1', 'secret-token');
		expect(details.can_accept).toBe(true);
		expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/app/workspace-invitations/inv-1', {
			params: { token: 'secret-token' },
			separateRateLimit: true
		});

		vi.mocked(apiRequest).mockResolvedValueOnce(getWorkspaceFixture('invitation-details').body);
		await getWorkspaceInvitation('inv-1');
		expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/app/workspace-invitations/inv-1', {
			params: undefined,
			separateRateLimit: true
		});
	});

	it('sends the token from the email link when there is one', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce(getWorkspaceFixture('invitation-accept').body);
		await acceptWorkspaceInvitation('inv-1', 'secret-token');
		expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/app/workspace-invitations/inv-1/accept', {
			method: 'POST',
			json: { token: 'secret-token' }
		});

		vi.mocked(apiRequest).mockResolvedValueOnce(undefined);
		await declineWorkspaceInvitation('inv-1');
		expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/app/workspace-invitations/inv-1/decline', {
			method: 'POST',
			json: {}
		});
	});
});
