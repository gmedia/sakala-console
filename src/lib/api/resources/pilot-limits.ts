import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

export type PilotLimits = Pick<
	components['schemas']['PilotLimitsResource'],
	'quotas' | 'runtime_defaults' | 'timeouts' | 'deleted_project_retention_days'
>;

const pilotLimitsResponseSchema = z.object({
	data: z.object({
		quotas: z.object({
			max_projects_per_user: z.number(),
			max_active_deployments_per_user: z.number(),
			max_active_deployments_per_project: z.number(),
			current_projects_count: z.number(),
			current_active_deployments_count: z.number()
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

export async function getPilotLimits(): Promise<PilotLimits> {
	const response = await apiRequest<unknown>('/api/v1/app/pilot-limits');
	return parsePilotLimitsResponse(response);
}
