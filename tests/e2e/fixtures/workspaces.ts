import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { createdProject, mockWizardApi, PROJECT_ID } from './create-project';
import { baseProject } from './project-detail';
import { signedInUser } from './all-routes';

/** A response captured from sakala-api, in tests/fixtures/workspaces. */
type Captured = { status: number; body: Record<string, unknown> | null };

export function captured(name: string): Captured {
	return JSON.parse(
		readFileSync(new URL(`../../fixtures/workspaces/${name}.json`, import.meta.url), 'utf8')
	) as Captured;
}

type Role = 'owner' | 'member' | 'viewer';
type Workspace = {
	id: string;
	name: string;
	slug: string;
	type: 'personal' | 'team';
	role: Role;
	limit_profile: { id: string; name: string } | null;
	projects_count: number;
	active_deployments_count: number;
	created_at: string | null;
};
type Member = {
	id: string;
	role: Role;
	joined_at: string | null;
	user: { id: number; name: string; username: string; avatar_url: string | null; email?: string };
};
type Invitation = {
	id: string;
	email: string;
	role: Role;
	expires_at: string;
	created_at: string | null;
	workspace: { id: string; name: string; slug: string };
	invited_by: { id: number; name: string; username: string } | null;
};

const ownerList = captured('workspaces').body!.data as Workspace[];
export const TEAM = ownerList[1];
export const TEAM_SUMMARY = { id: TEAM.id, name: TEAM.name, slug: TEAM.slug, type: 'team' };
const PERSONAL_OWNER = ownerList[0];

export const MEMBERS = captured('members').body!.data as Member[];
const pendingInvitations = captured('invitations').body!.data as Invitation[];
export const MY_INVITATION = (captured('invitations-mine').body!.data as Invitation[])[0];
export const EXPIRED_INVITATION_ID = '01a1cb4a-0000-7000-8000-00000000dead';

type InvitationDetails = Omit<Invitation, 'email'> & {
	restricted_to_invited_email: boolean;
	can_accept: boolean;
	accept_error_code: string | null;
};
/** An invitation sent to another address of the invitee, so it is not in their own list. */
export const LINK_INVITATION = captured('invitation-details').body!.data as InvitationDetails;
/** An owner invitation for another address. */
export const OWNER_LINK_INVITATION = captured('invitation-details-owner-restricted').body!
	.data as InvitationDetails;
/** Tokens in links that the API answers with a closed state. */
export const CLOSED_LINK_TOKENS = {
	'sudah-diterima': 'invitation-details-accepted',
	'sudah-ditolak': 'invitation-details-declined',
	'sudah-dibatalkan': 'invitation-details-revoked',
	kedaluwarsa: 'invitation-details-expired'
} as const;

export type Persona = 'owner' | 'viewer' | 'invitee';

const users: Record<Persona, typeof signedInUser> = {
	owner: {
		...signedInUser,
		id: 1,
		name: 'Rani Putri',
		username: 'rani',
		email: 'rani@kampus.test'
	},
	viewer: {
		...signedInUser,
		id: 3,
		name: 'Citra Lestari',
		username: 'citra',
		email: 'citra@kampus.test'
	},
	invitee: {
		...signedInUser,
		id: 4,
		name: 'Dewi Anggraini',
		username: 'dewi',
		email: 'dewi@kampus.test'
	}
};

function personalOf(persona: Persona): Workspace {
	const user = users[persona];
	return {
		...PERSONAL_OWNER,
		id: `0000000${user.id}-personal`,
		name: user.name,
		slug: user.username
	};
}

export type WorkspaceCalls = {
	createWorkspace: Record<string, unknown>[];
	invite: Record<string, unknown>[];
	changeRole: { memberId: string; body: Record<string, unknown> }[];
	removeMember: string[];
	accept: { id: string; body: Record<string, unknown> }[];
	decline: string[];
	reads: { id: string; token: string | null }[];
	projectLists: URL[];
	createProject: Record<string, unknown>[];
};

export type WorkspaceOptions = {
	persona: Persona;
	/** Teams the persona may own; the API caps it per user (2 by default). */
	ownedTeamCap?: number;
	/** Removing this membership is refused as the last owner, as if the list were stale. */
	refuseRemoval?: string;
};

function json(route: Route, status: number, body: unknown) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function replay(route: Route, name: string) {
	const { status, body } = captured(name);
	return json(route, status, body);
}

/**
 * The workspace API as sakala-api answers it, with state, so a test can create, invite, accept,
 * and change roles and see the screen follow. Bodies and error responses come from captures.
 */
export async function mockWorkspaceApi(page: Page, options: WorkspaceOptions) {
	const { persona, ownedTeamCap = 2 } = options;
	const user = users[persona];
	const calls: WorkspaceCalls = {
		createWorkspace: [],
		invite: [],
		changeRole: [],
		removeMember: [],
		accept: [],
		decline: [],
		reads: [],
		projectLists: [],
		createProject: []
	};

	const workspaces: Workspace[] =
		persona === 'owner'
			? [personalOf('owner'), { ...TEAM }]
			: persona === 'viewer'
				? [personalOf('viewer'), { ...TEAM, role: 'viewer' }]
				: [personalOf('invitee')];
	const members = new Map<string, Member[]>([[TEAM.id, structuredClone(MEMBERS)]]);
	const invitations = new Map<string, Invitation[]>([
		[TEAM.id, structuredClone(pendingInvitations)]
	]);
	const mine: Invitation[] =
		persona === 'invitee'
			? [
					structuredClone(MY_INVITATION),
					{
						...structuredClone(MY_INVITATION),
						id: EXPIRED_INVITATION_ID,
						workspace: { id: 'other-team', name: 'Tim Lama', slug: 'tim-lama' }
					}
				]
			: [];

	const teamProject = {
		...baseProject,
		name: 'Facility Reporting',
		project_name: 'Facility Reporting',
		slug: 'facility-reporting',
		repository_full_name: 'gmedia/facility-reporting',
		workspace: TEAM_SUMMARY
	};
	const personalProject = {
		...baseProject,
		id: 'personal-project',
		name: 'Tugas Pribadi',
		project_name: 'Tugas Pribadi',
		workspace: {
			id: workspaces[0].id,
			name: workspaces[0].name,
			slug: workspaces[0].slug,
			type: 'personal'
		}
	};
	const projectsIn = (workspaceId: string | null) =>
		[teamProject, personalProject].filter(
			(project) =>
				(!workspaceId && workspaces.some((item) => item.id === project.workspace.id)) ||
				project.workspace.id === workspaceId
		);
	// As WorkspaceResource counts them; nothing is deploying in these scenarios.
	const withCounts = (workspace: Workspace): Workspace => ({
		...workspace,
		projects_count: projectsIn(workspace.id).length,
		active_deployments_count: 0
	});

	const wizard = await mockWizardApi(page, {
		project: () => (persona === 'viewer' ? teamProject : createdProject),
		envList: () =>
			persona === 'viewer'
				? [
						{
							...((captured('env-list-viewer').body!.data as Record<string, unknown>[])[0] ?? {}),
							id: 1
						},
						{
							id: 2,
							key: 'APP_NAME',
							is_secret: false,
							value: 'facility',
							created_at: null,
							updated_at: null
						}
					]
				: [],
		createProject: (body) => {
			calls.createProject.push(body);
			const workspace = body.workspace_id === TEAM.id ? TEAM_SUMMARY : personalProject.workspace;
			return { status: 201, body: { data: { ...createdProject, ...body, workspace } } };
		}
	});

	await page.route('**/api/v1/auth/user', (route) => json(route, 200, { data: user }));

	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) => {
		const url = new URL(route.request().url());
		const team = url.searchParams.get('workspace_id');
		const fixture = captured(team ? 'pilot-limits-team' : 'pilot-limits-personal');
		const data = fixture.body!.data as { quotas: Record<string, number> };
		data.quotas.current_projects_count = projectsIn(team ?? workspaces[0].id).length;
		return json(route, 200, fixture.body);
	});

	await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) => {
		const request = route.request();
		if (request.method() !== 'GET') return route.fallback();
		const url = new URL(request.url());
		calls.projectLists.push(url);
		const data = projectsIn(url.searchParams.get('workspace_id'));
		return json(route, 200, {
			data,
			links: { first: null, last: null, prev: null, next: null },
			meta: {
				current_page: 1,
				from: 1,
				last_page: 1,
				links: [],
				path: null,
				per_page: 6,
				to: data.length,
				total: data.length
			}
		});
	});

	await page.route(/\/api\/v1\/app\/workspaces(\/.*)?(\?.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname.replace(/^.*\/api\/v1\/app\/workspaces/, '');
		const body = () => (request.postDataJSON() ?? {}) as Record<string, unknown>;
		const [, workspaceId, sub, itemId] = path.split('/');
		const workspace = workspaces.find((item) => item.id === workspaceId);
		const list = members.get(workspaceId ?? '') ?? [];
		const owners = () => list.filter((member) => member.role === 'owner').length;

		if (!workspaceId) {
			if (method === 'GET') return json(route, 200, { data: workspaces.map(withCounts) });
			calls.createWorkspace.push(body());
			const owned = workspaces.filter((item) => item.type === 'team' && item.role === 'owner');
			if (owned.length >= ownedTeamCap) return replay(route, 'workspace-create-cap');
			const created = {
				...(captured('workspace-create').body!.data as Workspace),
				id: `01a1cb4a-aaaa-7000-8000-00000000000${workspaces.length}`,
				name: String(body().name),
				slug: String(body().name).toLowerCase().replace(/\s+/g, '-'),
				limit_profile: null
			};
			workspaces.push(created);
			members.set(created.id, [{ ...MEMBERS[0], user: { ...MEMBERS[0].user, ...user } }]);
			invitations.set(created.id, []);
			return json(route, 201, { data: created });
		}
		if (!workspace) return json(route, 403, { message: 'This action is unauthorized.' });

		if (!sub) {
			if (method === 'GET') return json(route, 200, { data: withCounts(workspace) });
			if (method === 'PATCH') {
				workspace.name = String(body().name);
				return json(route, 200, { data: withCounts(workspace) });
			}
			if (method === 'DELETE') {
				if (projectsIn(workspace.id).length > 0) return replay(route, 'workspace-delete-not-empty');
				workspaces.splice(workspaces.indexOf(workspace), 1);
				return json(route, 204, null);
			}
		}
		if (sub === 'leave') {
			if (workspace.role === 'owner' && owners() <= 1) return replay(route, 'leave-last-owner');
			workspaces.splice(workspaces.indexOf(workspace), 1);
			return json(route, 204, null);
		}
		if (sub === 'members') {
			if (method === 'GET') {
				const showEmail = workspace.role === 'owner';
				return json(route, 200, {
					data: list.map((member) =>
						showEmail ? member : { ...member, user: { ...member.user, email: undefined } }
					)
				});
			}
			const target = list.find((member) => member.id === itemId);
			if (!target) return json(route, 404, { message: 'Not Found' });
			if (method === 'PATCH') {
				const role = body().role as Role;
				calls.changeRole.push({ memberId: target.id, body: body() });
				if (target.role === 'owner' && role !== 'owner' && owners() <= 1) {
					return replay(route, 'member-update-last-owner');
				}
				target.role = role;
				return json(route, 200, { data: target });
			}
			if (method === 'DELETE') {
				calls.removeMember.push(target.id);
				if (options.refuseRemoval === target.id || (target.role === 'owner' && owners() <= 1)) {
					return replay(route, 'member-remove-last-owner');
				}
				list.splice(list.indexOf(target), 1);
				return json(route, 204, null);
			}
		}
		if (sub === 'invitations') {
			const pending = invitations.get(workspace.id) ?? [];
			if (method === 'GET') return json(route, 200, { data: pending });
			if (method === 'POST') {
				const payload = body();
				calls.invite.push(payload);
				const email = String(payload.email).trim().toLowerCase();
				if (list.some((member) => member.user.email === email)) {
					return replay(route, 'invitation-create-member');
				}
				const created: Invitation = {
					...(captured('invitation-create').body!.data as Invitation),
					id: `01a1cb4a-bbbb-7000-8000-00000000000${pending.length}`,
					email,
					role: payload.role as Role
				};
				pending.unshift(created);
				return json(route, 201, { data: created });
			}
			if (method === 'DELETE') {
				invitations.set(
					workspace.id,
					pending.filter((invitation) => invitation.id !== itemId)
				);
				return json(route, 204, null);
			}
		}
		return route.fallback();
	});

	await page.route(/\/api\/v1\/app\/workspace-invitations(\/.*)?(\?.*)?$/, (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		const [, readId] = path.match(/workspace-invitations\/([^/]+)$/) ?? [];
		if (request.method() === 'GET' && readId) {
			calls.reads.push({ id: readId, token: url.searchParams.get('token') });
			return readInvitation(route, readId, url.searchParams.get('token'));
		}
		if (request.method() === 'GET') return json(route, 200, { data: mine });

		const [, id, action] = path.match(/workspace-invitations\/([^/]+)\/(accept|decline)$/) ?? [];
		const payload = (request.postDataJSON() ?? {}) as Record<string, unknown>;
		const invitation = mine.find((item) => item.id === id);
		if (action === 'decline') {
			calls.decline.push(id);
			if (!invitation && !payload.token) return replay(route, 'invitation-accept-revoked');
			mine.splice(mine.indexOf(invitation!), 1);
			return json(route, 204, null);
		}
		calls.accept.push({ id, body: payload });
		if (id === EXPIRED_INVITATION_ID) return replay(route, 'invitation-accept-expired');
		if (!invitation && !payload.token) return replay(route, 'invitation-accept-revoked');
		const role = invitation?.role ?? 'member';
		const joined = { ...TEAM, role };
		workspaces.push(joined);
		if (invitation) mine.splice(mine.indexOf(invitation), 1);
		return json(route, 200, { data: joined });
	});

	/**
	 * GET workspace-invitations/{id}, as the API answers it: through the token, or for an invitation
	 * in the caller's own list; a closed one with its code, anything else with the plain 404.
	 */
	function readInvitation(route: Route, id: string, token: string | null) {
		if (token && token in CLOSED_LINK_TOKENS) {
			return replay(route, CLOSED_LINK_TOKENS[token as keyof typeof CLOSED_LINK_TOKENS]);
		}
		if (id === EXPIRED_INVITATION_ID) return replay(route, 'invitation-details-expired');
		if (token && id === LINK_INVITATION.id) return replay(route, 'invitation-details');
		if (token && id === OWNER_LINK_INVITATION.id) {
			return replay(route, 'invitation-details-owner-restricted');
		}
		const own = mine.find((item) => item.id === id);
		if (own) {
			const details: InvitationDetails = {
				id: own.id,
				role: own.role,
				expires_at: own.expires_at,
				created_at: own.created_at,
				workspace: own.workspace,
				invited_by: own.invited_by,
				restricted_to_invited_email: own.role === 'owner',
				can_accept: true,
				accept_error_code: null
			};
			return json(route, 200, { data: details });
		}
		return replay(route, 'invitation-details-not-found');
	}

	return { calls, wizard, workspaces, members };
}

export { PROJECT_ID };
