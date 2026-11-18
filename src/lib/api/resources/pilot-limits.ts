import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

type GeneratedPilotLimits = components['schemas']['PilotLimitsResource'];
type GeneratedQuotas = GeneratedPilotLimits['quotas'];
/**
 * Fields an older API does not send: containers came with workspaces, `max_replicas` with replicas.
 * `max_builds_per_hour` is not read by the Console yet.
 */
type OptionalQuotaKey =
	| 'max_active_containers'
	| 'current_active_containers_count'
	| 'max_replicas'
	| 'max_builds_per_hour';

/**
 * The part of the resource the Console reads. The workspace, container, replica, and idle sleep
 * fields stay optional because an older API does not send them.
 */
type PilotLimitsContract = Pick<
	GeneratedPilotLimits,
	'runtime_defaults' | 'timeouts' | 'deleted_project_retention_days'
> & {
	quotas: Omit<GeneratedQuotas, OptionalQuotaKey> &
		Partial<Pick<GeneratedQuotas, OptionalQuotaKey>>;
	workspace_id?: GeneratedPilotLimits['workspace_id'];
	limit_profile?: GeneratedPilotLimits['limit_profile'];
	project_idle_sleep_minutes?: GeneratedPilotLimits['project_idle_sleep_minutes'];
};

const pilotLimitsResponseSchema = z.object({
	data: z.object({
		workspace_id: z.string().optional(),
		limit_profile: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
		quotas: z.object({
			max_projects_per_user: z.number(),
			max_active_deployments_per_user: z.number(),
			max_active_deployments_per_project: z.number(),
			current_projects_count: z.number(),
			current_active_deployments_count: z.number(),
			max_active_containers: z.number().optional(),
			current_active_containers_count: z.number().optional(),
			/** Most replicas per project; `1` means replicas are off for this workspace. */
			max_replicas: z.number().optional()
		}),
		runtime_defaults: z.object({
			memory_mb: z.number(),
			cpu_millis: z.number(),
			pids_limit: z.number()
		}),
		timeouts: z.object({
			build_timeout_seconds: z.number(),
			start_timeout_seconds: z.number(),
			command_timeout_seconds: z.number()
		}),
		deleted_project_retention_days: z.number(),
		/** `0`: projects of this workspace never sleep. */
		project_idle_sleep_minutes: z.number().optional()
	})
}) satisfies z.ZodType<{ data: PilotLimitsContract }>;

/**
 * The limits of one workspace, as parsed. Typed from the schema, so the workspace and container
 * fields stay optional like in the contract above.
 */
export type PilotLimits = z.output<typeof pilotLimitsResponseSchema>['data'];

export function parsePilotLimitsResponse(response: unknown): PilotLimits {
	return pilotLimitsResponseSchema.parse(response).data;
}

/**
 * Without a workspace the API answers for the caller's personal workspace, so the personal one is
 * asked for without the parameter.
 */
export async function getPilotLimits(workspaceId?: string | null): Promise<PilotLimits> {
	const response = workspaceId
		? await apiRequest<unknown>('/api/v1/app/pilot-limits', {
				params: { workspace_id: workspaceId }
			})
		: await apiRequest<unknown>('/api/v1/app/pilot-limits');
	return parsePilotLimitsResponse(response);
}
