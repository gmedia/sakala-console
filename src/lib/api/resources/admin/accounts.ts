import { z } from 'zod';
import { apiRequest } from '../../client';
import {
	namedRefSchema,
	paginated,
	single,
	type Paginated,
	type QueryParams,
	type WithReason
} from './common';
import { auditEventSchema } from './audit';

export const adminUserSchema = z.object({
	id: z.number(),
	name: z.string(),
	username: z.string(),
	email: z.string(),
	avatar_url: z.string().nullable(),
	role: z.string(),
	email_verified: z.boolean(),
	email_verified_at: z.string().nullable(),
	onboarding_source: z.string().nullable(),
	onboarding_completed_at: z.string().nullable(),
	last_login_at: z.string().nullable(),
	max_owned_teams: z.number().nullable(),
	created_projects_count: z.number().optional(),
	created_at: z.string().nullable()
});

export type AdminUser = z.infer<typeof adminUserSchema>;

const quotaSchema = z.object({
	limit_profile: namedRefSchema.nullable(),
	limits: z.object({
		max_projects: z.number(),
		max_active_containers: z.number(),
		max_active_deployments: z.number(),
		max_memory_mb: z.number(),
		max_cpu_millis: z.number(),
		max_builds_per_hour: z.number().nullable(),
		max_active_deployments_per_project: z.number(),
		/** Effective, from the profile or the global setting; `0` never sleeps. Newer APIs only. */
		idle_sleep_minutes: z.number().optional()
	}),
	usage: z.object({
		projects: z.number(),
		active_containers: z.number(),
		active_deployments: z.number()
	})
});

export type WorkspaceQuota = z.infer<typeof quotaSchema>;

const userDetailSchema = z.object({
	user: adminUserSchema,
	owned_teams_count: z.number(),
	effective_max_owned_teams: z.number().nullable(),
	workspaces: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			type: z.string(),
			role: z.string().nullable(),
			projects_count: z.number(),
			limit_profile: namedRefSchema.nullable()
		})
	),
	personal_workspace_quota: quotaSchema.nullable(),
	recent_audit_events: z.array(auditEventSchema)
});

export type AdminUserDetail = z.infer<typeof userDetailSchema>;

export const adminWorkspaceSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	type: z.string(),
	limit_profile: namedRefSchema.nullable(),
	personal_user: z.object({ id: z.number(), name: z.string(), username: z.string() }).nullable(),
	members_count: z.number().optional(),
	projects_count: z.number().optional(),
	created_at: z.string().nullable()
});

export type AdminWorkspace = z.infer<typeof adminWorkspaceSchema>;

const workspaceDetailSchema = z.object({
	workspace: adminWorkspaceSchema,
	members: z.array(
		z.object({
			id: z.string(),
			role: z.string(),
			joined_at: z.string().nullable(),
			user: z.object({
				id: z.number(),
				name: z.string(),
				username: z.string(),
				email: z.string(),
				avatar_url: z.string().nullable()
			})
		})
	),
	projects: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			status: z.string(),
			runtime_status: z.string(),
			created_at: z.string().nullable()
		})
	),
	quota: quotaSchema
});

export type AdminWorkspaceDetail = z.infer<typeof workspaceDetailSchema>;

export const limitProfileSchema = z.object({
	id: z.string(),
	name: z.string(),
	max_projects: z.number(),
	max_active_containers: z.number(),
	max_active_deployments: z.number(),
	max_memory_mb: z.number(),
	max_cpu_millis: z.number(),
	max_builds_per_hour: z.number().nullable(),
	/** `null` follows the global setting, `0` never sleeps. Missing from an older API. */
	idle_sleep_minutes: z.number().nullable().optional(),
	workspaces_count: z.number().optional(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
});

export type LimitProfile = z.infer<typeof limitProfileSchema>;

const userListSchema = paginated(adminUserSchema);
const userDetailResponseSchema = single(userDetailSchema);
const userResponseSchema = single(adminUserSchema);
const workspaceListSchema = paginated(adminWorkspaceSchema);
const workspaceDetailResponseSchema = single(workspaceDetailSchema);
const workspaceResponseSchema = single(adminWorkspaceSchema);
const limitProfileListSchema = paginated(limitProfileSchema);
const limitProfileResponseSchema = single(limitProfileSchema);

export const parseAdminUsers = (r: unknown): Paginated<AdminUser> => userListSchema.parse(r);
export const parseAdminUserDetail = (r: unknown): AdminUserDetail =>
	userDetailResponseSchema.parse(r).data;
export const parseAdminUser = (r: unknown): AdminUser => userResponseSchema.parse(r).data;
export const parseAdminWorkspaces = (r: unknown): Paginated<AdminWorkspace> =>
	workspaceListSchema.parse(r);
export const parseAdminWorkspaceDetail = (r: unknown): AdminWorkspaceDetail =>
	workspaceDetailResponseSchema.parse(r).data;
export const parseAdminWorkspace = (r: unknown): AdminWorkspace =>
	workspaceResponseSchema.parse(r).data;
export const parseLimitProfiles = (r: unknown): Paginated<LimitProfile> =>
	limitProfileListSchema.parse(r);
export const parseLimitProfile = (r: unknown): LimitProfile =>
	limitProfileResponseSchema.parse(r).data;

const USERS = 'api/v1/admin/users';
const WORKSPACES = 'api/v1/admin/workspaces';
const LIMIT_PROFILES = 'api/v1/admin/limit-profiles';

/** `search` (name, username, email), `role`, `verified` (`1` or `0`), `page`, `per_page`. */
export async function listAdminUsers(params: QueryParams) {
	return parseAdminUsers(await apiRequest<unknown>(USERS, { params }));
}

export async function getAdminUser(id: number | string) {
	return parseAdminUserDetail(await apiRequest<unknown>(`${USERS}/${id}`));
}

/** 409 `ADMIN_SELF_DEMOTION` or `LAST_ADMIN` when demoting would leave no way back. */
export async function updateAdminUserRole(
	id: number,
	body: WithReason & { role: 'user' | 'admin' }
) {
	return parseAdminUser(
		await apiRequest<unknown>(`${USERS}/${id}/role`, { method: 'PATCH', json: body })
	);
}

/** `null` returns the user to the configured default. */
export async function updateAdminUserTeamLimit(
	id: number,
	body: WithReason & { max_owned_teams: number | null }
) {
	return parseAdminUser(
		await apiRequest<unknown>(`${USERS}/${id}/team-limit`, { method: 'PATCH', json: body })
	);
}

/** Attaches the profile to the user's personal workspace; `null` is the personal default. */
export async function assignAdminUserLimitProfile(
	id: number,
	body: WithReason & { limit_profile_id: string | null }
) {
	return parseAdminWorkspace(
		await apiRequest<unknown>(`${USERS}/${id}/limit-profile`, { method: 'PUT', json: body })
	);
}

/** `search` (name, slug), `type`, `limit_profile_id`, `page`, `per_page`. */
export async function listAdminWorkspaces(params: QueryParams) {
	return parseAdminWorkspaces(await apiRequest<unknown>(WORKSPACES, { params }));
}

export async function getAdminWorkspace(id: string) {
	return parseAdminWorkspaceDetail(await apiRequest<unknown>(`${WORKSPACES}/${id}`));
}

export async function assignAdminWorkspaceLimitProfile(
	id: string,
	body: WithReason & { limit_profile_id: string | null }
) {
	return parseAdminWorkspace(
		await apiRequest<unknown>(`${WORKSPACES}/${id}/limit-profile`, { method: 'PUT', json: body })
	);
}

export type LimitProfileFields = Pick<
	LimitProfile,
	| 'name'
	| 'max_projects'
	| 'max_active_containers'
	| 'max_active_deployments'
	| 'max_memory_mb'
	| 'max_cpu_millis'
	| 'max_builds_per_hour'
	| 'idle_sleep_minutes'
>;

export async function listLimitProfiles(params: QueryParams) {
	return parseLimitProfiles(await apiRequest<unknown>(LIMIT_PROFILES, { params }));
}

export async function createLimitProfile(body: WithReason & LimitProfileFields) {
	return parseLimitProfile(
		await apiRequest<unknown>(LIMIT_PROFILES, { method: 'POST', json: body })
	);
}

/** Partial: fields left out stay as they are. Applies to every workspace on the profile at once. */
export async function updateLimitProfile(
	id: string,
	body: WithReason & Partial<LimitProfileFields>
) {
	return parseLimitProfile(
		await apiRequest<unknown>(`${LIMIT_PROFILES}/${id}`, { method: 'PATCH', json: body })
	);
}

/** 409 `LIMIT_PROFILE_IN_USE` with `workspaces` while any workspace runs under it. */
export async function deleteLimitProfile(id: string, body: WithReason) {
	await apiRequest<void>(`${LIMIT_PROFILES}/${id}`, { method: 'DELETE', json: body });
}
