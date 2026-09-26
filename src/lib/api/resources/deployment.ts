import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type GeneratedDeployment = components['schemas']['DeploymentResource'];
export type Deployment = GeneratedDeployment;

export type GeneratedDeploymentEvent = components['schemas']['DeploymentEventResource'];
export type DeploymentEvent = GeneratedDeploymentEvent;

type DeploymentResponse =
	operations['projects.deployments.show']['responses'][200]['content']['application/json'];
export type DeploymentEventsResponse =
	operations['deployment.events']['responses'][200]['content']['application/json'];

export class DeploymentEventsTruncationError extends Error {
	readonly name = 'DeploymentEventsTruncationError';
	readonly isRetryable = false;

	constructor(
		readonly deploymentId: string,
		readonly pagesFetched: number,
		readonly eventsFetched: number,
		readonly remainingCursor: string
	) {
		super(
			`[getAllDeploymentEvents] Truncated at ${pagesFetched} pages ` +
				`(${eventsFetched} events) for deployment ${deploymentId}; ` +
				`next_cursor still present: ${remainingCursor}. ` +
				`Increase MAX_EVENT_PAGES or add "since_sequence" on the backend.`
		);
	}
}

const MAX_EVENT_PAGES = 50;

const deploymentFailureSchema = z.object({
	code: z.string(),
	category: z.string(),
	summary: z.string(),
	recovery_hint: z.string()
});

const requestedResourcesSchema = z.object({
	memory_mb: z.number().nullable(),
	cpu_millis: z.number().nullable(),
	pids_limit: z.number().nullable()
});

const appliedResourcesSchema = z.object({
	memory_mb: z.number(),
	cpu_millis: z.number(),
	pids_limit: z.number()
});

const effectiveResourcesSchema = z.object({
	resources: z.object({
		memory_mb: z.number(),
		cpu_millis: z.number(),
		pids_limit: z.number()
	}),
	timeouts: z.object({
		build_timeout_seconds: z.number(),
		start_timeout_seconds: z.number(),
		command_timeout_seconds: z.number()
	}),
	log_bounds: z.object({
		max_line_length: z.number(),
		max_batch_lines: z.number(),
		max_total_bytes: z.number()
	})
});

const deploymentSchema = z.object({
	id: z.string(),
	project_id: z.string(),
	sequence: z.number(),
	branch: z.string(),
	status: z.string(),
	trigger: z.string(),
	commit_sha: z.string().nullable(),
	commit_message: z.string().nullable(),
	image_reference: z.string().nullable(),
	requested_resources: requestedResourcesSchema.nullable(),
	effective_resources: effectiveResourcesSchema.nullable(),
	applied_resources: appliedResourcesSchema.nullable(),
	finalization_deferred: z.boolean(),
	finalization_deferred_reason: z.enum(['grace_elapsed', 'runtime_error']).nullable(),
	agent_node_id: z.string().nullable(),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	cancelled_at: z.string().nullable(),
	failure_code: z.string().nullable(),
	failure_summary: z.string().nullable(),
	failure: deploymentFailureSchema.nullable(),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<Deployment>;

const deploymentEventSchema = z.object({
	sequence: z.number(),
	level: z.enum(['info', 'warning', 'error']),
	type: z.string().nullable(),
	message: z.string(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	occurred_at: z.string()
}) satisfies z.ZodType<DeploymentEvent>;

const deploymentResponseSchema = z.object({
	data: deploymentSchema
}) satisfies z.ZodType<DeploymentResponse>;

const deploymentEventsResponseSchema = z.object({
	data: z.array(deploymentEventSchema),
	links: z.object({
		first: z.string().nullable(),
		last: z.string().nullable(),
		prev: z.string().nullable(),
		next: z.string().nullable()
	}),
	meta: z.object({
		path: z.string().nullable(),
		per_page: z.number(),
		next_cursor: z.string().nullable(),
		prev_cursor: z.string().nullable()
	})
}) satisfies z.ZodType<DeploymentEventsResponse>;

export async function getDeployment(
	project: string,
	deployment: string
): Promise<DeploymentResponse> {
	const response = await apiRequest<unknown>(
		`api/v1/app/projects/${project}/deployments/${deployment}`
	);

	try {
		return parseDeploymentResponse(response);
	} catch (error) {
		console.error('[getDeployment] ZodError', error);
		console.error('[getDeployment] response', response);
		throw error;
	}
}

export async function getDeploymentEvents(
	project: string,
	deployment: string,
	params?: { cursor?: string; per_page?: number }
): Promise<DeploymentEventsResponse> {
	const response = await apiRequest<unknown>(
		`api/v1/app/projects/${project}/deployments/${deployment}/events`,
		{ params }
	);

	return parseDeploymentEventsResponse(response);
}

export async function getAllDeploymentEvents(
	project: string,
	deployment: string
): Promise<DeploymentEventsResponse> {
	const allEvents: DeploymentEvent[] = [];
	let cursor: string | undefined = undefined;
	let pageCount = 0;
	let lastResponse: DeploymentEventsResponse | null = null;

	while (pageCount < MAX_EVENT_PAGES) {
		pageCount++;
		lastResponse = await getDeploymentEvents(project, deployment, { cursor });
		allEvents.push(...lastResponse.data);

		const nextCursor = lastResponse.meta.next_cursor;
		if (!nextCursor) {
			return {
				data: allEvents,
				links: lastResponse.links,
				meta: {
					path: lastResponse.meta.path,
					per_page: allEvents.length,
					next_cursor: null,
					prev_cursor: null
				}
			};
		}

		cursor = nextCursor;
	}

	throw new DeploymentEventsTruncationError(
		deployment,
		pageCount,
		allEvents.length,
		lastResponse?.meta.next_cursor ?? 'unknown'
	);
}

export function parseDeploymentResponse(response: unknown): DeploymentResponse {
	return deploymentResponseSchema.parse(response);
}

export function parseDeploymentEventsResponse(response: unknown): DeploymentEventsResponse {
	return deploymentEventsResponseSchema.parse(response);
}
