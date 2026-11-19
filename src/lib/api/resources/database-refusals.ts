import { z } from 'zod';

/*
 * The fields sakala-api adds to a refused database request (DatabaseRuleException and its
 * subclasses, docs/API_CONVENTIONS.md "Database"). Kept apart from `databases.ts`, which pulls in
 * the HTTP client: presentation code reads these details from an `ApiError` without it.
 */

const projectRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
const databaseRefSchema = z.object({ id: z.string(), name: z.string() });

const schemas = {
	/** `limit` 0: the workspace may not create databases at all. */
	DATABASE_LIMIT_EXCEEDED: z.object({ limit: z.number(), current: z.number() }),
	DATABASE_STORAGE_LIMIT_EXCEEDED: z.object({ limit_mb: z.number(), current_bytes: z.number() }),
	/** `null`: no database node anywhere takes new databases. */
	DATABASE_REGION_UNAVAILABLE: z.object({ region: z.string().nullable() }),
	DATABASE_CROSS_REGION_UNSUPPORTED: z.object({
		database_region: z.string(),
		project_region: z.string()
	}),
	DATABASE_NOT_READY: z.object({ status: z.string() }),
	DATABASE_IN_USE: z.object({ projects: z.array(projectRefSchema) }),
	PROJECT_DATABASE_ALREADY_ATTACHED: z.object({ database: databaseRefSchema }),
	DATABASE_ENDPOINT_UNAVAILABLE: z.object({ database: databaseRefSchema })
} as const;

export type DatabaseRefusalCode = keyof typeof schemas;
export type DatabaseRefusalDetails<Code extends DatabaseRefusalCode> = z.output<
	(typeof schemas)[Code]
>;

/** The documented fields of a refusal, or `null` when an API sent them in another shape. */
export function parseDatabaseRefusal<Code extends DatabaseRefusalCode>(
	code: Code,
	details: Record<string, unknown>
): DatabaseRefusalDetails<Code> | null {
	const parsed = schemas[code].safeParse(details);
	return parsed.success ? (parsed.data as DatabaseRefusalDetails<Code>) : null;
}
