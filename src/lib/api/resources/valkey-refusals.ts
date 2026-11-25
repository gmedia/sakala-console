import { z } from 'zod';

/*
 * The fields sakala-api adds to a refused Valkey request (ValkeyRuleException and its subclasses,
 * docs/API_CONVENTIONS.md "Valkey"). Kept apart from `valkeys.ts`, which pulls in the HTTP client:
 * presentation code reads these details from an `ApiError` without it.
 */

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
const valkeyRefSchema = z.object({ id: z.string(), name: z.string() });

const schemas = {
	/** `limit` 0: the workspace may not create stores at all. */
	VALKEY_LIMIT_EXCEEDED: z.object({ limit: z.number(), current: z.number() }),
	/** `current_mb` is what the workspace's other stores reserve, without this one. */
	VALKEY_MEMORY_LIMIT_EXCEEDED: z.object({
		limit_mb: z.number(),
		current_mb: z.number(),
		requested_mb: z.number()
	}),
	VALKEY_NOT_READY: z.object({ status: z.string() }),
	VALKEY_IN_USE: z.object({ projects: z.array(projectRefSchema) }),
	PROJECT_VALKEY_ALREADY_ATTACHED: z.object({ valkey: valkeyRefSchema }),
	VALKEY_NODE_MISMATCH: z.object({ valkey: valkeyRefSchema }),
	VALKEY_PASSWORD_ROTATING: z.object({ valkey: valkeyRefSchema })
} as const;

export type ValkeyRefusalCode = keyof typeof schemas;
export type ValkeyRefusalDetails<Code extends ValkeyRefusalCode> = z.output<(typeof schemas)[Code]>;

/** The documented fields of a refusal, or `null` when an API sent them in another shape. */
export function parseValkeyRefusal<Code extends ValkeyRefusalCode>(
	code: Code,
	details: Record<string, unknown>
): ValkeyRefusalDetails<Code> | null {
	const parsed = schemas[code].safeParse(details);
	return parsed.success ? (parsed.data as ValkeyRefusalDetails<Code>) : null;
}
