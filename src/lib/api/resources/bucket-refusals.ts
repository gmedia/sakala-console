import { z } from 'zod';

/*
 * The fields sakala-api adds to a refused bucket request (BucketRuleException and its subclasses,
 * docs/API_CONVENTIONS.md "Bucket"). Kept apart from `buckets.ts`, which pulls in the HTTP client:
 * presentation code reads these details from an `ApiError` without it.
 */

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
const bucketRefSchema = z.object({ id: z.string(), name: z.string() });

const schemas = {
	/** `limit` 0: the workspace may not create buckets at all. */
	BUCKET_LIMIT_EXCEEDED: z.object({ limit: z.number(), current: z.number() }),
	/** `current_mb` is what the workspace's other buckets reserve, without this one. */
	BUCKET_STORAGE_LIMIT_EXCEEDED: z.object({
		limit_mb: z.number(),
		current_mb: z.number(),
		requested_mb: z.number()
	}),
	/** `null`: no storage node anywhere takes new buckets. */
	BUCKET_REGION_UNAVAILABLE: z.object({ region: z.string().nullable() }),
	BUCKET_NOT_READY: z.object({ status: z.string() }),
	BUCKET_IN_USE: z.object({ projects: z.array(projectRefSchema) }),
	PROJECT_BUCKET_ALREADY_ATTACHED: z.object({ bucket: bucketRefSchema }),
	BUCKET_ENDPOINT_UNAVAILABLE: z.object({ bucket: bucketRefSchema }),
	BUCKET_KEY_ROTATING: z.object({ bucket: bucketRefSchema })
} as const;

export type BucketRefusalCode = keyof typeof schemas;
export type BucketRefusalDetails<Code extends BucketRefusalCode> = z.output<(typeof schemas)[Code]>;

/** The documented fields of a refusal, or `null` when an API sent them in another shape. */
export function parseBucketRefusal<Code extends BucketRefusalCode>(
	code: Code,
	details: Record<string, unknown>
): BucketRefusalDetails<Code> | null {
	const parsed = schemas[code].safeParse(details);
	return parsed.success ? (parsed.data as BucketRefusalDetails<Code>) : null;
}
