import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type GeneratedDeployment = components['schemas']['DeploymentResource'];
export type Deployment = GeneratedDeployment;

export type GeneratedDeploymentEvent = components['schemas']['DeploymentEventResource'];
export type DeploymentEvent = GeneratedDeploymentEvent;

export type GeneratedDeploymentLog = components['schemas']['DeploymentLogResource'];
export type DeploymentLog = GeneratedDeploymentLog;

type DeploymentResponse =
	operations['projects.deployments.show']['responses'][200]['content']['application/json'];
export type DeploymentEventsResponse =
	operations['deployment.events']['responses'][200]['content']['application/json'];
export type DeploymentLogsResponse =
	operations['deployment.logs']['responses'][200]['content']['application/json'];

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
/** The most the API allows. Its default of 6 would cost one request per 6 events on every read. */
const EVENT_PAGE_SIZE = 10;

/**
 * These fields only decorate a screen, and PHP encodes an empty map as `[]`. A surprise in one of
 * them must not take the whole deployment page down, so it reads as "not known".
 */
function decorative<T extends z.ZodType>(schema: T) {
	return schema.nullable().catch(({ issues, input }) => {
		// An empty list is just how PHP says "empty". Anything else is drift someone should see.
		if (input !== undefined && !(Array.isArray(input) && input.length === 0)) {
			console.warn('[deployment] field diabaikan karena bentuknya tidak dikenal', issues);
		}
		return null;
	});
}

const deploymentFailureSchema = z.object({
	code: z.string(),
	category: z.string(),
	summary: z.string(),
	recovery_hint: z.string(),
	user_fixable: z.boolean(),
	detail: z.string().nullable(),
	stage: z
		.enum(['queued', 'cloning', 'analyzing', 'building', 'deploying', 'routing', 'health_checking'])
		.nullable()
		.catch(null)
});

const requestedResourcesSchema = z.object({
	memory_mb: z.number().nullable(),
	cpu_millis: z.number().nullable(),
	pids_limit: z.number().nullable()
});

const appliedResourcesSchema = z.object({
	memory_mb: z.number().nullable(),
	cpu_millis: z.number().nullable(),
	pids_limit: z.number().nullable()
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
	requested_resources: decorative(requestedResourcesSchema),
	effective_resources: decorative(effectiveResourcesSchema),
	applied_resources: decorative(appliedResourcesSchema),
	finalization_deferred: z.boolean(),
	finalization_deferred_reason: decorative(z.enum(['grace_elapsed', 'runtime_error'])),
	agent_node_id: z.string().nullable(),
	is_active: z.boolean(),
	cancel_requested_at: z.string().nullable(),
	queue_state: decorative(z.enum(['assigned', 'waiting_for_node'])),
	started_at: z.string().nullable(),
	finished_at: z.string().nullable(),
	cancelled_at: z.string().nullable(),
	failure_code: z.string().nullable(),
	failure_summary: z.string().nullable(),
	failure: decorative(deploymentFailureSchema),
	created_at: z.string().nullable(),
	updated_at: z.string().nullable()
}) satisfies z.ZodType<Deployment>;

const deploymentEventSchema = z.object({
	sequence: z.number(),
	level: z.enum(['info', 'warning', 'error']),
	type: z.string().nullable(),
	message: z.string(),
	metadata: decorative(z.record(z.string(), z.unknown())),
	occurred_at: z.string()
}) satisfies z.ZodType<DeploymentEvent>;

const deploymentResponseSchema = z.object({
	data: deploymentSchema
}) satisfies z.ZodType<DeploymentResponse>;

const deploymentLogSchema = z.object({
	sequence: z.number(),
	stream: z.enum(['stdout', 'stderr', 'system']),
	message: z.string(),
	recorded_at: z.string()
}) satisfies z.ZodType<DeploymentLog>;

const cursorLinksSchema = z.object({
	first: z.string().nullable(),
	last: z.string().nullable(),
	prev: z.string().nullable(),
	next: z.string().nullable()
});

const cursorMetaSchema = z.object({
	path: z.string().nullable(),
	per_page: z.number(),
	next_cursor: z.string().nullable(),
	prev_cursor: z.string().nullable()
});

/** One bad row is dropped and reported, so the rows around it still reach the screen. */
function tolerantList<T extends z.ZodType>(item: T, label: string) {
	return z.array(z.unknown()).transform((rows) =>
		rows.flatMap((row) => {
			const parsed = item.safeParse(row);
			if (parsed.success) return [parsed.data as z.output<T>];
			console.warn(`[deployment] ${label} dilewati karena bentuknya tidak dikenal`, parsed.error);
			return [];
		})
	);
}

const deploymentEventsResponseSchema = z.object({
	data: tolerantList(deploymentEventSchema, 'event'),
	links: cursorLinksSchema,
	meta: cursorMetaSchema
}) satisfies z.ZodType<DeploymentEventsResponse>;

const deploymentLogsResponseSchema = z.object({
	data: tolerantList(deploymentLogSchema, 'baris log'),
	links: cursorLinksSchema,
	meta: cursorMetaSchema
}) satisfies z.ZodType<DeploymentLogsResponse>;

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

/**
 * One page of logs. With `order=desc` the first page holds the newest lines and `next_cursor` walks
 * back through older ones. `per_page` goes up to 200.
 */
export async function getDeploymentLogs(
	project: string,
	deployment: string,
	params?: { cursor?: string; per_page?: number; order?: 'asc' | 'desc' }
): Promise<DeploymentLogsResponse> {
	const response = await apiRequest<unknown>(
		`api/v1/app/projects/${project}/deployments/${deployment}/logs`,
		{ params }
	);

	return parseDeploymentLogsResponse(response);
}

/**
 * Asks the API to stop a deployment. A queued one is cancelled at once; a running one keeps its
 * status and gets `cancel_requested_at` until its node has stopped it. The API repeats 200 for one
 * that is already cancelled and answers 409 `DEPLOYMENT_ALREADY_FINISHED` for a finished one.
 */
export async function cancelDeployment(
	project: string,
	deployment: string
): Promise<DeploymentResponse> {
	const response = await apiRequest<unknown>(
		`api/v1/app/projects/${project}/deployments/${deployment}/cancel`,
		{ method: 'POST' }
	);

	return parseDeploymentResponse(response);
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
		lastResponse = await getDeploymentEvents(project, deployment, {
			cursor,
			per_page: EVENT_PAGE_SIZE
		});
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

export function parseDeploymentLogsResponse(response: unknown): DeploymentLogsResponse {
	return deploymentLogsResponseSchema.parse(response);
}
