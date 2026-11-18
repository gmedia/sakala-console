import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

type GeneratedProjectMetrics = components['schemas']['ProjectMetricsResource'];
type GeneratedSeries = GeneratedProjectMetrics['series'];

/** The ranges the API accepts, shortest first. */
export const PROJECT_METRICS_RANGES = [
	'1h',
	'6h',
	'24h',
	'7d',
	'30d'
] as const satisfies readonly GeneratedProjectMetrics['range'][];
export type ProjectMetricsRange = (typeof PROJECT_METRICS_RANGES)[number];

/** The start of a step, ISO 8601 in UTC on the wire, as Unix seconds here: what the chart draws. */
const timestampSchema = z.iso
	.datetime({ offset: true })
	.transform((value) => Date.parse(value) / 1_000);

/** What the API sends for one point matches the generated contract; `t` comes out as seconds. */
const statPointSchema = z.object({
	t: timestampSchema,
	avg: z.number().finite(),
	max: z.number().finite()
}) satisfies z.ZodType<unknown, GeneratedSeries['cpu_percent'][number]>;
const countPointSchema = z.object({
	t: timestampSchema,
	count: z.number().finite()
}) satisfies z.ZodType<unknown, GeneratedSeries['replicas'][number]>;

/** A broken point is dropped on its own, like a broken log line, instead of failing the whole read. */
function pointsOf<T extends z.ZodType>(point: T) {
	return z.array(z.unknown()).transform((items) =>
		items.flatMap((item) => {
			const parsed = point.safeParse(item);
			return parsed.success ? [parsed.data as z.output<T>] : [];
		})
	);
}

const projectMetricsSchema = z.object({
	range: z.string(),
	/** Width of one step. Two points further apart than this have a gap between them. */
	step_seconds: z.number().positive(),
	series: z.object({
		/** Percent of one core, summed over the replicas, so it can go past 100. */
		cpu_percent: pointsOf(statPointSchema),
		/** Bytes, summed over the replicas. */
		memory_bytes: pointsOf(statPointSchema),
		/**
		 * The limits of the replicas in the newest step, added up. `null` without data, or when a
		 * replica runs without a limit. One number for the newest data, not a series.
		 */
		memory_limit_bytes: z.number().positive().nullable() satisfies z.ZodType<
			GeneratedSeries['memory_limit_bytes']
		>,
		/** Replicas that reported in each step. */
		replicas: pointsOf(countPointSchema),
		/** Container restarts within each step, summed over the replicas. */
		restarts: pointsOf(countPointSchema)
	})
});

/** `per_replica`, sent only with `per_replica=1`, is not asked for and not read. */
const projectMetricsResponseSchema = z.object({ data: projectMetricsSchema });

export type ProjectMetrics = z.output<typeof projectMetricsSchema>;
export type MetricStatPoint = ProjectMetrics['series']['cpu_percent'][number];
export type MetricCountPoint = ProjectMetrics['series']['replicas'][number];

export function parseProjectMetricsResponse(response: unknown): ProjectMetrics {
	return projectMetricsResponseSchema.parse(response).data;
}

/** `range` is always sent: without it the API answers for 1 hour, not the Console's 24 hours. */
export async function getProjectMetrics(
	projectId: string,
	range: ProjectMetricsRange
): Promise<ProjectMetrics> {
	const response = await apiRequest<unknown>(`/api/v1/app/projects/${projectId}/metrics`, {
		params: { range }
	});
	return parseProjectMetricsResponse(response);
}
