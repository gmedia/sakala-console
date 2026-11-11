import { z } from 'zod';
import { apiRequest } from '../../client';
import {
	deploymentSchema,
	parseDeploymentEventsResponse,
	parseDeploymentLogsResponse
} from '../deployment';
import {
	paginated,
	single,
	timeRangeSchema,
	userRefSchema,
	type Paginated,
	type QueryParams
} from './common';

const failureProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	slug: z.string(),
	workspace_id: z.string().nullable(),
	deleted: z.boolean()
});

export const failedDeploymentSchema = z.object({
	id: z.string(),
	project: failureProjectSchema.nullable(),
	sequence: z.number(),
	branch: z.string().nullable(),
	commit_sha: z.string().nullable(),
	trigger: z.string(),
	agent_node_id: z.string().nullable(),
	requested_by: userRefSchema.nullable(),
	failure: z.object({
		code: z.string().nullable(),
		category: z.string(),
		summary: z.string().nullable(),
		user_fixable: z.boolean().nullable(),
		detail: z.string().nullable(),
		stage: z.string().nullable()
	}),
	created_at: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	duration_seconds: z.number().nullable()
});

export type FailedDeployment = z.infer<typeof failedDeploymentSchema>;

const failureSummarySchema = z.object({
	range: timeRangeSchema,
	total: z.number(),
	previous_total: z.number().nullable(),
	categories: z.array(
		z.object({ category: z.string(), count: z.number(), previous_count: z.number().nullable() })
	),
	codes: z.array(z.object({ code: z.string().nullable(), category: z.string(), count: z.number() }))
});

export type FailureSummary = z.infer<typeof failureSummarySchema>;

const adminDeploymentSchema = z.object({
	deployment: deploymentSchema,
	project: z
		.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			repository_url: z.string().nullable(),
			workspace_id: z.string().nullable(),
			deleted: z.boolean()
		})
		.nullable(),
	requested_by: userRefSchema.nullable(),
	agent_node: z.object({ id: z.string(), agent_id: z.string(), name: z.string() }).nullable(),
	duration_seconds: z.number().nullable()
});

export type AdminDeployment = z.infer<typeof adminDeploymentSchema>;

const failureListSchema = paginated(failedDeploymentSchema);
const summaryResponseSchema = single(failureSummarySchema);
const deploymentResponseSchema = single(adminDeploymentSchema);

export const parseFailedDeployments = (r: unknown): Paginated<FailedDeployment> =>
	failureListSchema.parse(r);
export const parseFailureSummary = (r: unknown): FailureSummary =>
	summaryResponseSchema.parse(r).data;
export const parseAdminDeployment = (r: unknown): AdminDeployment =>
	deploymentResponseSchema.parse(r).data;

const DEPLOYMENTS = 'api/v1/admin/deployments';

/** `range` (default `30d`, `all` allowed), `category`, `code`, `search` (project name or slug). */
export async function listFailedDeployments(params: QueryParams) {
	return parseFailedDeployments(await apiRequest<unknown>(`${DEPLOYMENTS}/failures`, { params }));
}

export async function getFailureSummary(params: QueryParams) {
	return parseFailureSummary(
		await apiRequest<unknown>(`${DEPLOYMENTS}/failure-summary`, { params })
	);
}

export async function getAdminDeployment(id: string) {
	return parseAdminDeployment(await apiRequest<unknown>(`${DEPLOYMENTS}/${id}`));
}

/** Same shape as the member endpoint. The API caps `per_page` at 10. */
export async function getAdminDeploymentEvents(id: string, cursor?: string) {
	return parseDeploymentEventsResponse(
		await apiRequest<unknown>(`${DEPLOYMENTS}/${id}/events`, {
			params: { per_page: 10, cursor }
		})
	);
}

/** Newest lines first; `next_cursor` walks back to older ones. */
export async function getAdminDeploymentLogs(id: string, cursor?: string) {
	return parseDeploymentLogsResponse(
		await apiRequest<unknown>(`${DEPLOYMENTS}/${id}/logs`, {
			params: { order: 'desc', per_page: 200, cursor }
		})
	);
}
