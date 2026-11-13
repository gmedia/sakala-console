import { z } from 'zod';
import type { components } from '../generated/schema';

/*
 * Kept apart from `projects.ts`, which pulls in the HTTP client: presentation code reads these
 * details from an `ApiError` and must stay importable without it.
 */
type ProjectWakeConflict =
	components['responses']['ProjectWakeConflict']['content']['application/json'];

const wakeLimitDetailsSchema = z.object({
	limit: z.number(),
	current: z.number()
}) satisfies z.ZodType<Required<Pick<ProjectWakeConflict, 'limit' | 'current'>>>;

export type WakeLimitDetails = z.output<typeof wakeLimitDetailsSchema>;

/**
 * The counts a `PROJECT_WAKE_LIMIT_EXCEEDED` refusal carries on the Console endpoint. `null` when
 * they are missing, so the caller falls back to the API's own message.
 */
export function parseWakeLimitDetails(details: Record<string, unknown>): WakeLimitDetails | null {
	const parsed = wakeLimitDetailsSchema.safeParse(details);
	return parsed.success ? parsed.data : null;
}
