import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

/*
 * Custom domains of a project (ADR-024, docs/CUSTOM_DOMAINS.md in sakala-api). Every endpoint
 * answers 404 while the server's `SAKALA_CUSTOM_DOMAINS_ENABLED` is off; the Console asks only once
 * `pilot-limits` says `custom_domains.enabled`. Checked against responses captured from the API in
 * tests/fixtures/domains.
 */

type GeneratedDomain = components['schemas']['ProjectDomainResource'];

/** `released` claims stay listed until their owner deletes them, so the Console shows them too. */
export const DOMAIN_STATUS = {
	pending: 'pending',
	verified: 'verified',
	failed: 'failed',
	disabled: 'disabled',
	released: 'released'
} as const satisfies Record<string, GeneratedDomain['status']>;

export const DOMAIN_KIND = {
	apex: 'apex',
	subdomain: 'subdomain'
} as const satisfies Record<string, GeneratedDomain['kind']>;

/**
 * `dns_records[].type`. `ALIAS` is the apex's pointing record: CNAME flattening, ALIAS, or ANAME,
 * whichever the DNS provider offers. Sakala never asks for an A record.
 */
export const DNS_RECORD_TYPE = {
	txt: 'TXT',
	cname: 'CNAME',
	alias: 'ALIAS'
} as const satisfies Record<string, GeneratedDomain['dns_records'][number]['type']>;

/** `last_check.reasons[].code`, as CustomDomainCheckReason in sakala-api names them. */
export const DOMAIN_CHECK_REASON = {
	txtMissing: 'txt_missing',
	txtMismatch: 'txt_mismatch',
	cnameRequired: 'cname_required',
	pointsElsewhere: 'points_elsewhere',
	extraAddresses: 'extra_addresses',
	noAddress: 'no_address',
	caaForbidsIssuer: 'caa_forbids_issuer',
	dnsError: 'dns_error',
	domainTaken: 'domain_taken'
} as const;

/** `last_check.routing_match`: `addresses` only for an apex found by its addresses. */
export const ROUTING_MATCH = { cname: 'cname', addresses: 'addresses' } as const;

const dnsRecordSchema = z.object({ type: z.string(), name: z.string(), value: z.string() });
export type DnsRecord = z.output<typeof dnsRecordSchema>;

const checkReasonSchema = z.object({
	code: z.string(),
	/** Indonesian, written by the API, names the record to change. */
	message: z.string()
});
export type DomainCheckReason = z.output<typeof checkReasonSchema>;

/*
 * `status`, `kind`, record `type`, reason `code`, and `routing_match` stay plain strings, so a
 * newer value still renders.
 */
export const projectDomainSchema = z.object({
	id: z.string(),
	project_id: z.string(),
	/** Final lowercase ASCII form; an international name is punycode (`xn--`). */
	hostname: z.string(),
	kind: z.string(),
	status: z.string(),
	/** The name the domain points at with a CNAME. Never an IP address. */
	target: z.string(),
	/** The TXT record first, then the pointing record. */
	dns_records: z.array(dnsRecordSchema),
	last_check: z.object({
		/** `null` before the first check. */
		checked_at: z.string().nullable(),
		/** Empty when the last check passed. */
		reasons: z.array(checkReasonSchema),
		routing_match: z.string().nullable()
	}),
	next_check_at: z.string().nullable(),
	verified_at: z.string().nullable(),
	/** The first failing check of a verified domain since its last pass. */
	failing_since: z.string().nullable(),
	/** When a failing verified domain is disabled unless its DNS is fixed. */
	disable_at: z.string().nullable(),
	failed_at: z.string().nullable(),
	disabled_at: z.string().nullable(),
	/** Until when a disabled domain comes back on its own; `null` for an admin's disable. */
	reactivation_ends_at: z.string().nullable(),
	admin_disabled: z.boolean(),
	admin_disabled_reason: z.string().nullable(),
	released_at: z.string().nullable(),
	/** Verified, but the project's node cannot serve custom domains yet: visitors get a 404. */
	waiting_for_node: z.boolean(),
	created_at: z.string().nullable()
}) satisfies z.ZodType<
	Omit<
		GeneratedDomain,
		'kind' | 'status' | 'dns_records' | 'last_check' | 'waiting_for_node' | 'created_at'
	> & {
		kind: string;
		status: string;
		dns_records: DnsRecord[];
		last_check: { checked_at: string | null; reasons: DomainCheckReason[] };
		/**
		 * The generated document types this as `string`: Scramble reads the resource's property
		 * through `withWaitingForNode()`. The API sends a boolean (see the captured fixtures). To fix
		 * in sakala-api with an `@var bool` on the field.
		 */
		waiting_for_node: boolean;
		created_at: string | null;
	},
	unknown
>;

export type ProjectDomain = z.output<typeof projectDomainSchema>;

const domainListSchema = z.object({ data: z.array(projectDomainSchema) });
const domainResponseSchema = z.object({ data: projectDomainSchema });

export const parseProjectDomain = (response: unknown): ProjectDomain =>
	domainResponseSchema.parse(response).data;
export const parseProjectDomainList = (response: unknown): ProjectDomain[] =>
	domainListSchema.parse(response).data;

const segment = (value: string) => encodeURIComponent(value);
const domainsPath = (projectId: string) => `/api/v1/app/projects/${segment(projectId)}/domains`;
const domainPath = (projectId: string, domainId: string) =>
	`${domainsPath(projectId)}/${segment(domainId)}`;

/** Oldest first. Every member of the workspace reads them. */
export async function listProjectDomains(projectId: string): Promise<ProjectDomain[]> {
	return parseProjectDomainList(await apiRequest<unknown>(domainsPath(projectId)));
}

/**
 * Adds a `pending` claim with a new token. The API normalizes the name (case, scheme, path, port,
 * trailing dot, IDN). 422 with `errors.hostname` for a name that cannot be a custom domain, or
 * `CUSTOM_DOMAIN_LIMIT_EXCEEDED`; 409 `DOMAIN_TAKEN` when it is active on another project.
 */
export async function addProjectDomain(
	projectId: string,
	hostname: string
): Promise<ProjectDomain> {
	return parseProjectDomain(
		await apiRequest<unknown>(domainsPath(projectId), { method: 'POST', json: { hostname } })
	);
}

/**
 * Checks the domain's DNS now and applies the result as the scheduled check would. 429 beyond 6 per
 * minute per domain or 12 per minute per user; a POST, so it never blocks the Console's reads.
 */
export async function checkProjectDomain(
	projectId: string,
	domainId: string
): Promise<ProjectDomain> {
	return parseProjectDomain(
		await apiRequest<unknown>(`${domainPath(projectId, domainId)}/check`, { method: 'POST' })
	);
}

/** 204. A verified domain stops serving within about 10 seconds. */
export async function deleteProjectDomain(projectId: string, domainId: string): Promise<void> {
	await apiRequest<void>(domainPath(projectId, domainId), { method: 'DELETE' });
}
