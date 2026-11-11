import { z } from 'zod';
import { apiRequest } from '../../client';
import { single, timeRangeSchema, type QueryParams } from './common';

const outcomesSchema = z.object({
	succeeded: z.number(),
	failed: z.number(),
	cancelled: z.number(),
	in_progress: z.number(),
	total: z.number()
});

export type DeploymentOutcomes = z.infer<typeof outcomesSchema>;

const overviewSchema = z.object({
	range: timeRangeSchema,
	generated_at: z.string(),
	totals: z.object({ users: z.number(), projects: z.number(), active_projects: z.number() }),
	period: z.object({
		new_users: z.number(),
		new_projects: z.number(),
		deployments: outcomesSchema
	}),
	previous_period: z.object({
		from: z.string().nullable(),
		to: z.string().nullable(),
		new_users: z.number(),
		new_projects: z.number(),
		deployments: outcomesSchema
	}),
	user_growth: z.array(z.object({ date: z.string(), count: z.number() })),
	failure_categories: z.array(z.object({ category: z.string(), count: z.number() })),
	top_failure_codes: z.array(
		z.object({ code: z.string().nullable(), category: z.string(), count: z.number() })
	),
	new_user_sources: z.array(z.object({ source: z.string().nullable(), count: z.number() })),
	pilot: z.object({
		activated_users: z.number(),
		unique_deployers: z.number(),
		repeat_deployers: z.number(),
		feedback_count: z.number()
	})
});

export type AdminOverview = z.infer<typeof overviewSchema>;

const overviewResponseSchema = single(overviewSchema);

export function parseAdminOverview(response: unknown): AdminOverview {
	return overviewResponseSchema.parse(response).data;
}

/** `range` is `7d`, `30d`, `90d`, or `custom` with `from` and `to` (`Y-m-d`). Cached 60 s by the API. */
export async function getAdminOverview(params: QueryParams): Promise<AdminOverview> {
	return parseAdminOverview(await apiRequest<unknown>('api/v1/admin/overview', { params }));
}
