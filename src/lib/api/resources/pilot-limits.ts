import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

type GeneratedPilotLimits = components['schemas']['PilotLimitsResource'];
type GeneratedQuotas = GeneratedPilotLimits['quotas'];
type ContainerQuotaKey = 'max_active_containers' | 'current_active_containers_count';

/**
 * The part of the resource the Console reads. The workspace and container fields stay optional
 * because an API from before workspaces does not send them.
 */
type PilotLimitsContract = Pick<
	GeneratedPilotLimits,
	'runtime_defaults' | 'timeouts' | 'deleted_project_retention_days'
> & {
	quotas: Omit<GeneratedQuotas, ContainerQuotaKey> &
		Partial<Pick<GeneratedQuotas, ContainerQuotaKey>>;
	workspace_id?: GeneratedPilotLimits['workspace_id'];
	limit_profile?: GeneratedPilotLimits['limit_profile'];
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
			current_active_containers_count: z.number().optional()
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
		deleted_project_retention_days: z.number()
	})
}) satisfies z.ZodType<{ data: PilotLimitsContract }>;

/**
 * The limits of one workspace, as parsed. Typed from the schema because the API documents
 * `runtime_defaults.memory_mb` and `cpu_millis` without a type.
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
