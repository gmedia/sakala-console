import { z } from 'zod';
import { apiRequest } from '../client';

/*
 * Written from the workspace resources in sakala-api (WorkspaceResource, WorkspaceMemberResource,
 * WorkspaceInvitationResource, WorkspaceInvitationDetailsResource) and checked against responses
 * captured from it in tests/fixtures/workspaces. The generated OpenAPI types predate workspaces.
 */

export const workspaceRoleSchema = z.enum(['owner', 'member', 'viewer']);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceTypeSchema = z.enum(['personal', 'team']);
export type WorkspaceType = z.infer<typeof workspaceTypeSchema>;

export const limitProfileRefSchema = z.object({ id: z.string(), name: z.string() });

export const workspaceSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	type: workspaceTypeSchema,
	/** The caller's role here. */
	role: workspaceRoleSchema,
	/** Null when the workspace runs under the default limits of its type. */
	limit_profile: limitProfileRefSchema.nullable(),
	/** Projects in the workspace, not counting deleted ones waiting for purge. */
	projects_count: z.number().int().nonnegative(),
	/** Deployments queued or running there now, the number its concurrent deployment limit counts. */
	active_deployments_count: z.number().int().nonnegative(),
	created_at: z.string().nullable()
});
export type Workspace = z.infer<typeof workspaceSchema>;

/** The owning workspace as project resources carry it. The caller's role is not part of it. */
export const workspaceSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	type: workspaceTypeSchema
});
export type WorkspaceSummary = z.infer<typeof workspaceSummarySchema>;

export const workspaceMemberSchema = z.object({
	/** The membership ID, used by PATCH and DELETE on members; not the user ID. */
	id: z.string(),
	role: workspaceRoleSchema,
	joined_at: z.string().nullable(),
	user: z.object({
		id: z.number(),
		name: z.string(),
		username: z.string(),
		avatar_url: z.string().nullable(),
		/** Only owners see addresses. */
		email: z.string().optional()
	})
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceInvitationSchema = z.object({
	id: z.string(),
	email: z.string(),
	role: workspaceRoleSchema,
	expires_at: z.string(),
	created_at: z.string().nullable(),
	workspace: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
	/** Null once the inviter's account is deleted. */
	invited_by: z.object({ id: z.number(), name: z.string(), username: z.string() }).nullable()
});
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;

/** The codes accepting would answer now, as GET workspace-invitations/{id} reports them. */
export const acceptErrorCodeSchema = z.enum([
	'INVITATION_EMAIL_MISMATCH',
	'ALREADY_WORKSPACE_MEMBER',
	'TEAM_LIMIT_EXCEEDED'
]);
export type AcceptErrorCode = z.infer<typeof acceptErrorCodeSchema>;

/**
 * An open invitation for whoever holds its link. It never carries the invited address, because
 * the holder may be signed in with another account.
 */
export const workspaceInvitationDetailsSchema = workspaceInvitationSchema
	.omit({ email: true })
	.extend({
		/** Owner invitations: only the account with the invited verified address can accept. */
		restricted_to_invited_email: z.boolean(),
		can_accept: z.boolean(),
		/** Null when `can_accept` is true. */
		accept_error_code: acceptErrorCodeSchema.nullable()
	});
export type WorkspaceInvitationDetails = z.infer<typeof workspaceInvitationDetailsSchema>;

const workspaceListSchema = z.object({ data: z.array(workspaceSchema) });
const workspaceResponseSchema = z.object({ data: workspaceSchema });
const memberListSchema = z.object({ data: z.array(workspaceMemberSchema) });
const memberResponseSchema = z.object({ data: workspaceMemberSchema });
const invitationListSchema = z.object({ data: z.array(workspaceInvitationSchema) });
const invitationResponseSchema = z.object({ data: workspaceInvitationSchema });
const invitationDetailsResponseSchema = z.object({ data: workspaceInvitationDetailsSchema });

export const parseWorkspaceList = (response: unknown) => workspaceListSchema.parse(response).data;
export const parseWorkspace = (response: unknown) => workspaceResponseSchema.parse(response).data;
export const parseMemberList = (response: unknown) => memberListSchema.parse(response).data;
export const parseMember = (response: unknown) => memberResponseSchema.parse(response).data;
export const parseInvitationList = (response: unknown) => invitationListSchema.parse(response).data;
export const parseInvitation = (response: unknown) => invitationResponseSchema.parse(response).data;
export const parseInvitationDetails = (response: unknown) =>
	invitationDetailsResponseSchema.parse(response).data;

const base = '/api/v1/app/workspaces';
const workspacePath = (id: string) => `${base}/${encodeURIComponent(id)}`;

/** Every workspace the caller belongs to, the personal one first. */
export async function listWorkspaces(): Promise<Workspace[]> {
	return parseWorkspaceList(await apiRequest<unknown>(base));
}

export async function createWorkspace(name: string): Promise<Workspace> {
	return parseWorkspace(await apiRequest<unknown>(base, { method: 'POST', json: { name } }));
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
	return parseWorkspace(
		await apiRequest<unknown>(workspacePath(id), { method: 'PATCH', json: { name } })
	);
}

export async function deleteWorkspace(id: string): Promise<void> {
	await apiRequest<void>(workspacePath(id), { method: 'DELETE' });
}

export async function leaveWorkspace(id: string): Promise<void> {
	await apiRequest<void>(`${workspacePath(id)}/leave`, { method: 'POST' });
}

export async function listWorkspaceMembers(id: string): Promise<WorkspaceMember[]> {
	return parseMemberList(await apiRequest<unknown>(`${workspacePath(id)}/members`));
}

export async function updateWorkspaceMemberRole(
	workspaceId: string,
	memberId: string,
	role: WorkspaceRole
): Promise<WorkspaceMember> {
	return parseMember(
		await apiRequest<unknown>(
			`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}`,
			{ method: 'PATCH', json: { role } }
		)
	);
}

export async function removeWorkspaceMember(workspaceId: string, memberId: string): Promise<void> {
	await apiRequest<void>(`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}`, {
		method: 'DELETE'
	});
}

export async function listWorkspaceInvitations(id: string): Promise<WorkspaceInvitation[]> {
	return parseInvitationList(await apiRequest<unknown>(`${workspacePath(id)}/invitations`));
}

export async function inviteToWorkspace(
	workspaceId: string,
	payload: { email: string; role: WorkspaceRole }
): Promise<WorkspaceInvitation> {
	return parseInvitation(
		await apiRequest<unknown>(`${workspacePath(workspaceId)}/invitations`, {
			method: 'POST',
			json: payload
		})
	);
}

export async function revokeWorkspaceInvitation(
	workspaceId: string,
	invitationId: string
): Promise<void> {
	await apiRequest<void>(
		`${workspacePath(workspaceId)}/invitations/${encodeURIComponent(invitationId)}`,
		{ method: 'DELETE' }
	);
}

/** Invitations addressed to the caller's verified email that have not expired. */
export async function listMyInvitations(): Promise<WorkspaceInvitation[]> {
	return parseInvitationList(await apiRequest<unknown>('/api/v1/app/workspace-invitations'));
}

const invitationPath = (id: string) =>
	`/api/v1/app/workspace-invitations/${encodeURIComponent(id)}`;

/**
 * One invitation, read with the token from the email link, or without it when it is addressed to
 * the caller's verified email. A wrong token answers 404 whatever the invitation's state; with the
 * right one, a closed invitation answers 409 with INVITATION_ALREADY_ACCEPTED, INVITATION_DECLINED,
 * INVITATION_REVOKED, or INVITATION_EXPIRED. Shares a rate limit of 5 a minute with accept and
 * decline.
 */
export async function getWorkspaceInvitation(
	id: string,
	token?: string
): Promise<WorkspaceInvitationDetails> {
	return parseInvitationDetails(
		await apiRequest<unknown>(invitationPath(id), {
			params: token ? { token } : undefined,
			// Behind the account-security limit, which says nothing about other reads.
			separateRateLimit: true
		})
	);
}

/** The token comes from the email link. Without it the invitation must be for the caller's email. */
export async function acceptWorkspaceInvitation(id: string, token?: string): Promise<Workspace> {
	return parseWorkspace(
		await apiRequest<unknown>(`${invitationPath(id)}/accept`, {
			method: 'POST',
			json: token ? { token } : {}
		})
	);
}

export async function declineWorkspaceInvitation(id: string, token?: string): Promise<void> {
	await apiRequest<void>(`${invitationPath(id)}/decline`, {
		method: 'POST',
		json: token ? { token } : {}
	});
}
