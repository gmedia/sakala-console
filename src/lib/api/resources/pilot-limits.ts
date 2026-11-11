import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

type GeneratedPilotLimits = Pick<
	components['schemas']['PilotLimitsResource'],
	'quotas' | 'runtime_defaults' | 'timeouts' | 'deleted_project_retention_days'
>;

/**
 * The limits of one workspace. The generated type predates workspaces, so the workspace fields are
 * added here; they are optional because an API from before workspaces does not send them.
 */
export type PilotLimits = Omit<GeneratedPilotLimits, 'quotas'> & {
	quotas: GeneratedPilotLimits['quotas'] & {
		max_active_containers?: number;
		current_active_containers_count?: number;
	};
	workspace_id?: string;
	limit_profile?: { id: string; name: string } | null;
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
}) satisfies z.ZodType<{ data: PilotLimits }>;

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
