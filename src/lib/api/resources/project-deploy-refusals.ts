import { z } from 'zod';

/*
 * The fields sakala-api adds to a refused deployment (docs/API_CONVENTIONS.md, "Kode error"). The
 * OpenAPI document does not describe these bodies yet, so the schemas follow the documented table.
 * Kept apart from `projects.ts`, which pulls in the HTTP client: presentation code reads these
 * details from an `ApiError` and must stay importable without it.
 */

const containerLimitDetailsSchema = z.object({
	limit: z.number(),
	/** Running containers in the workspace, every replica counted, this project's included. */
	current: z.number(),
	/** Replicas the deployment runs. Missing from an API without replicas. */
	requested: z.number().optional()
});

export type ContainerLimitDetails = z.output<typeof containerLimitDetailsSchema>;

/** The counts of an `ACTIVE_CONTAINER_LIMIT_EXCEEDED` refusal, or `null` when they are missing. */
export function parseContainerLimitDetails(
	details: Record<string, unknown>
): ContainerLimitDetails | null {
	const parsed = containerLimitDetailsSchema.safeParse(details);
	return parsed.success ? parsed.data : null;
}

const replicasUnsupportedDetailsSchema = z.object({
	/** The replicas the project is set to run. */
	replicas: z.number(),
	/**
	 * The largest per-project maximum a node reported, or `null` when no node runs replicas.
	 * Missing from the first API with replicas, which read the same as `null`.
	 */
	node_maximum: z.number().nullable().optional()
});

export type ReplicasUnsupportedDetails = z.output<typeof replicasUnsupportedDetailsSchema>;

/** The setting a `PROJECT_REPLICAS_UNSUPPORTED` refusal names, or `null` when it is missing. */
export function parseReplicasUnsupportedDetails(
	details: Record<string, unknown>
): ReplicasUnsupportedDetails | null {
	const parsed = replicasUnsupportedDetailsSchema.safeParse(details);
	return parsed.success ? parsed.data : null;
}
