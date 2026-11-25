import { z } from 'zod';

/*
 * The fields sakala-api adds to a refused custom domain request (CustomDomainRuleException and its
 * subclasses, docs/API_CONVENTIONS.md "Error Bisnis"). Kept apart from `project-domains.ts`, which
 * pulls in the HTTP client: presentation code reads these from an `ApiError` without it.
 */

const schemas = {
	/** `limit` 0: the workspace may not use custom domains at all. */
	CUSTOM_DOMAIN_LIMIT_EXCEEDED: z.object({ limit: z.number(), current: z.number() }),
	/** The final form of the name, active on another project. */
	DOMAIN_TAKEN: z.object({ hostname: z.string() })
} as const;

export type DomainRefusalCode = keyof typeof schemas;
export type DomainRefusalDetails<Code extends DomainRefusalCode> = z.output<(typeof schemas)[Code]>;

/** The documented fields of a refusal, or `null` when an API sent them in another shape. */
export function parseDomainRefusal<Code extends DomainRefusalCode>(
	code: Code,
	details: Record<string, unknown>
): DomainRefusalDetails<Code> | null {
	const parsed = schemas[code].safeParse(details);
	return parsed.success ? (parsed.data as DomainRefusalDetails<Code>) : null;
}
