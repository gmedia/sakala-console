import { z } from 'zod';
import { apiRequest } from '../../client';
import { paginated, single, userRefSchema, type Paginated, type QueryParams } from './common';

export const adminProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	status: z.string(),
	runtime_status: z.string(),
	repository_url: z.string().nullable(),
	repository_full_name: z.string().nullable(),
	branch: z.string().nullable(),
	public_url: z.string().nullable(),
	active_deployment_id: z.string().nullable(),
	workspace: z
		.object({ id: z.string(), name: z.string(), slug: z.string(), type: z.string() })
		.nullable(),
	creator: userRefSchema.nullable(),
	latest_deployment: z.looseObject({ id: z.string(), status: z.string() }).nullable(),
	suspension: z
		.object({ reason: z.string().nullable(), suspended_at: z.string().nullable() })
		.nullable(),
	last_deployed_at: z.string().nullable(),
	created_at: z.string().nullable()
});

export type AdminProject = z.infer<typeof adminProjectSchema>;

const projectDetailSchema = z.object({
	project: adminProjectSchema,
	deployments_count: z.number(),
	effective_port: z.number(),
	inspection_status: z.string().nullable(),
	control_requests: z.array(
		z.object({
			id: z.number(),
			action: z.string(),
			reason: z.string(),
			actor_id: z.string(),
			agent_command_id: z.string().nullable(),
			created_at: z.string().nullable()
		})
	)
});

export type AdminProjectDetail = z.infer<typeof projectDetailSchema>;

const controlResultSchema = z.object({
	project_id: z.string(),
	status: z.string(),
	runtime_status: z.string(),
	command: z.object({ id: z.string(), type: z.string(), status: z.string() }).nullable()
});

export type ProjectControlResult = z.infer<typeof controlResultSchema>;

const projectListSchema = paginated(adminProjectSchema);
const projectDetailResponseSchema = single(projectDetailSchema);
const controlResponseSchema = single(controlResultSchema);

export const parseAdminProjects = (r: unknown): Paginated<AdminProject> =>
	projectListSchema.parse(r);
export const parseAdminProjectDetail = (r: unknown): AdminProjectDetail =>
	projectDetailResponseSchema.parse(r).data;
export const parseProjectControlResult = (r: unknown): ProjectControlResult =>
	controlResponseSchema.parse(r).data;

const PROJECTS = 'api/v1/admin/projects';

/** `search` (name, slug, owner/repo), `status`, `runtime_status`, `workspace_id`, `suspended`. */
export async function listAdminProjects(params: QueryParams) {
	return parseAdminProjects(await apiRequest<unknown>(PROJECTS, { params }));
}

export async function getAdminProject(id: string) {
	return parseAdminProjectDetail(await apiRequest<unknown>(`${PROJECTS}/${id}`));
}

export type ProjectControlAction = 'stop' | 'suspend' | 'unsuspend' | 'reconcile';

export type ReconcileOptions = {
	desired_state: 'running' | 'stopped' | 'missing';
	actions: ('restart_log_follower' | 'cleanup_failed_candidate' | 'restore_route')[];
};

export type ProjectControlRequest = {
	reason: string;
	/** One key per dialog: a resend of the same request is a retry, not a second command. */
	idempotencyKey: string;
	reconcile?: ReconcileOptions;
};

/**
 * Answers `202`: the command is queued, not done. The project changes once its node reports back.
 * `409` when the state does not allow it (nothing serving, already suspended, a command running).
 */
export async function controlAdminProject(
	id: string,
	action: ProjectControlAction,
	{ reason, idempotencyKey, reconcile }: ProjectControlRequest
) {
	const json = action === 'reconcile' ? { reason, ...reconcile } : { reason };
	return parseProjectControlResult(
		await apiRequest<unknown>(`${PROJECTS}/${id}/${action}`, {
			method: 'POST',
			json,
			headers: { 'Idempotency-Key': idempotencyKey }
		})
	);
}
