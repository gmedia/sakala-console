import { z } from 'zod';
import type { components } from '../generated/schema';

/*
 * The fields sakala-api adds to a refused worker or schedule request (docs/API_CONVENTIONS.md "Error
 * Bisnis"). Kept apart from `schedules.ts`, which pulls in the HTTP client: presentation code reads
 * these details from an `ApiError` without it.
 */

/** Why Run now was refused, the reasons a slot is skipped for (ScheduleRunRefusedException). */
export const SCHEDULE_RUN_REFUSAL_REASONS = {
	overlap: 'overlap',
	projectSuspended: 'project_suspended',
	noLiveDeployment: 'no_live_deployment',
	nodeUnsupported: 'node_unsupported'
} as const satisfies Record<string, components['schemas']['ScheduleRunReason']>;

export type ScheduleRunRefusalReason =
	(typeof SCHEDULE_RUN_REFUSAL_REASONS)[keyof typeof SCHEDULE_RUN_REFUSAL_REASONS];

const schemas = {
	SCHEDULE_LIMIT_EXCEEDED: z.object({ limit: z.number(), current: z.number() }),
	SCHEDULE_RUN_REFUSED: z.object({ reason: z.string() }),
	/** `current`: worker containers of other projects; `requested`: this project's. */
	WORKER_CONTAINER_LIMIT_EXCEEDED: z.object({
		limit: z.number(),
		current: z.number(),
		requested: z.number()
	})
} as const;

export type WorkloadRefusalCode = keyof typeof schemas;
export type WorkloadRefusalDetails<Code extends WorkloadRefusalCode> = z.output<
	(typeof schemas)[Code]
>;

/** The documented fields of a refusal, or `null` when an API sent them in another shape. */
export function parseWorkloadRefusal<Code extends WorkloadRefusalCode>(
	code: Code,
	details: Record<string, unknown>
): WorkloadRefusalDetails<Code> | null {
	const parsed = schemas[code].safeParse(details);
	return parsed.success ? (parsed.data as WorkloadRefusalDetails<Code>) : null;
}
