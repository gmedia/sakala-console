import { z } from 'zod';
import { apiRequest } from '../../client';
import { projectDomainSchema } from '../project-domains';
import { paginated, single, type Paginated, type QueryParams } from './common';

/*
 * Custom domains across projects, for admins (ADR-024, docs/CUSTOM_DOMAINS.md "Admin" in
 * sakala-api). Every endpoint answers 404 while `SAKALA_CUSTOM_DOMAINS_ENABLED` is off. Checked
 * against tests/fixtures/domains/admin-*.json.
 */

export const adminCustomDomainSchema = z.object({
	/** The claim, as the project's own list shows it. */
	domain: projectDomainSchema,
	/** `null` only if the project is gone, which the list never returns. */
	project: z
		.object({
			id: z.string(),
			name: z.string(),
			slug: z.string(),
			workspace_id: z.string().nullable()
		})
		.nullable(),
	/** The user id of whoever added the claim. */
	created_by: z.number().nullable()
});

export type AdminCustomDomain = z.infer<typeof adminCustomDomainSchema>;

const listSchema = paginated(adminCustomDomainSchema);
const itemSchema = single(adminCustomDomainSchema);

export const parseAdminCustomDomains = (r: unknown): Paginated<AdminCustomDomain> =>
	listSchema.parse(r);
export const parseAdminCustomDomain = (r: unknown): AdminCustomDomain => itemSchema.parse(r).data;

const CUSTOM_DOMAINS = 'api/v1/admin/custom-domains';

/**
 * Newest first. `search` (hostname), `status`, `project_id`, `workspace_id`, `failing` (`1` for
 * verified domains whose checks fail), `page`, `per_page`.
 */
export async function listAdminCustomDomains(params: QueryParams) {
	return parseAdminCustomDomains(await apiRequest<unknown>(CUSTOM_DOMAINS, { params }));
}

/**
 * Disables the domain at once, tells the project's people the reason, and keeps it off until an
 * admin enables it. `reason` is 3 to 500 characters (422 otherwise).
 */
export async function disableAdminCustomDomain(id: string, reason: string) {
	return parseAdminCustomDomain(
		await apiRequest<unknown>(`${CUSTOM_DOMAINS}/${encodeURIComponent(id)}/disable`, {
			method: 'POST',
			json: { reason }
		})
	);
}

/**
 * Lifts an admin's disable. The domain stays `disabled`, is checked at once, and becomes `verified`
 * again when its DNS passes. 422 when no admin disabled it.
 */
export async function enableAdminCustomDomain(id: string) {
	return parseAdminCustomDomain(
		await apiRequest<unknown>(`${CUSTOM_DOMAINS}/${encodeURIComponent(id)}/enable`, {
			method: 'POST'
		})
	);
}
