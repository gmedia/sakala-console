import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { parse as parseDomain } from 'tldts';
import { TEAM_WORKSPACE } from './databases';
import { baseProject, mockProjectApi, personalWorkspace, PROJECT_ID } from './project-detail';

/** Bodies captured from sakala-api main 4943fbd, #213 (tests/fixtures/domains). */
export function capturedDomain<T = unknown>(
	name: string
): { status: number; body: T; headers?: Record<string, string> } {
	const file = new URL(`../../fixtures/domains/${name}.json`, import.meta.url);
	return JSON.parse(readFileSync(file, 'utf8')) as {
		status: number;
		body: T;
		headers?: Record<string, string>;
	};
}

export type MockDomain = {
	id: string;
	project_id: string;
	hostname: string;
	kind: string;
	status: string;
	target: string;
	dns_records: { type: string; name: string; value: string }[];
	last_check: {
		checked_at: string | null;
		reasons: { code: string; message: string }[];
		routing_match: string | null;
	};
	next_check_at: string | null;
	verified_at: string | null;
	failing_since: string | null;
	disable_at: string | null;
	failed_at: string | null;
	disabled_at: string | null;
	reactivation_ends_at: string | null;
	admin_disabled: boolean;
	admin_disabled_reason: string | null;
	released_at: string | null;
	waiting_for_node: boolean;
	created_at: string | null;
};

/**
 * One captured domain, moved onto the project of project-detail.ts. `index` picks from a list
 * fixture (`domains-*`), whose first item is the subdomain and second the apex.
 */
export function domainFrom(name: string, index = 0): MockDomain {
	const body = capturedDomain<{ data: MockDomain | MockDomain[] }>(name).body.data;
	const domain = Array.isArray(body) ? body[index] : body;
	return { ...structuredClone(domain), project_id: PROJECT_ID };
}

/** The states the Console tells apart, each from a real response. */
export const domainStates = {
	pendingNew: () => domainFrom('domain-create'),
	pendingCaa: () => domainFrom('domain-check-caa'),
	pendingMissing: () => domainFrom('domain-check-missing'),
	pendingDnsError: () => domainFrom('domain-check-dns-error'),
	apexPending: () => domainFrom('domain-check-apex-missing'),
	apexPointsElsewhere: () => domainFrom('domain-check-apex-points-elsewhere'),
	active: () => domainFrom('domain-check-verified'),
	apexActive: () => domainFrom('domain-check-apex-verified'),
	failing: () => domainFrom('domains-failing-warned', 0),
	disabled: () => domainFrom('domains-disabled', 0),
	adminDisabled: () => domainFrom('domains-admin-disabled', 1),
	failed: () => domainFrom('domains-failed', 0),
	released: () => domainFrom('domains-released', 0),
	waitingForNode: () => domainFrom('domains-waiting-for-node', 0)
};

type JsonReply = { status?: number; body?: unknown; headers?: Record<string, string> };

export type DomainMockOptions = {
	domains?: MockDomain[];
	role?: 'owner' | 'member' | 'viewer';
	/** `max_custom_domains` of the workspace (default 1, the hosted default). */
	max?: number;
	/** `custom_domains.enabled` on pilot-limits (default true): the server's flag. */
	enabled?: boolean;
	/** Answers POST .../domains instead of the store, for refusals. */
	add?: (hostname: string) => JsonReply | undefined;
	/** The domain after "Periksa sekarang", or a reply such as a 429. Default: unchanged. */
	check?: (domain: MockDomain) => MockDomain | JsonReply;
	project?: Record<string, unknown>;
};

export type DomainCalls = { method: string; path: string; body: unknown }[];

function fulfill(route: Route, { status = 200, body, headers }: JsonReply) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({
		status,
		headers,
		contentType: 'application/json',
		body: JSON.stringify(body ?? {})
	});
}

/** A new claim, shaped like the captured one, for whatever name was sent. */
function created(hostname: string, count: number): MockDomain {
	const apex = parseDomain(hostname, { allowPrivateDomains: true }).domain === hostname;
	const base = domainFrom(apex ? 'domain-create-apex' : 'domain-create');
	const token = base.dns_records[0].value;
	return {
		...base,
		id: `domain-new-${count}`,
		hostname,
		dns_records: [
			{ type: 'TXT', name: `_sakala.${hostname}`, value: token },
			{ type: apex ? 'ALIAS' : 'CNAME', name: hostname, value: base.target }
		],
		created_at: new Date().toISOString()
	};
}

/**
 * The project mocks, in a team workspace, plus the custom domain endpoints answered from an
 * in-memory store. While `enabled` is false every domain endpoint answers 404, like the API with
 * its flag off, and the calls are still recorded so a test can assert there were none.
 */
export async function mockDomainsApi(
	page: Page,
	options: DomainMockOptions = {}
): Promise<{ calls: DomainCalls; store: MockDomain[] }> {
	const store = options.domains ?? [];
	const calls: DomainCalls = [];
	const role = options.role ?? 'owner';
	const enabled = options.enabled ?? true;
	const workspace = { ...TEAM_WORKSPACE, role };
	const max = options.max ?? 1;

	await mockProjectApi(page, {
		project: () => ({
			...baseProject,
			workspace: {
				id: workspace.id,
				name: workspace.name,
				slug: workspace.slug,
				type: workspace.type
			},
			databases: [],
			buckets: [],
			...options.project
		})
	});

	await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
		fulfill(route, {
			body: {
				data: [{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 }, workspace]
			}
		})
	);
	await page.addInitScript(([key, id]) => window.localStorage.setItem(key, id), [
		`sakala.active-workspace.1`,
		workspace.id
	] as const);
	await page.route('**/api/v1/app/notifications/unread-count', (route) =>
		fulfill(route, { body: { data: { count: 0 } } })
	);
	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) => {
		const limits = capturedDomain<{
			data: Record<string, unknown> & { quotas: Record<string, unknown> };
		}>(enabled ? 'pilot-limits-domains' : 'pilot-limits-domains-off').body.data;
		return fulfill(route, {
			body: {
				data: {
					...limits,
					workspace_id: workspace.id,
					custom_domains: { enabled, target: 'edge.sakala.app' },
					quotas: {
						...limits.quotas,
						max_custom_domains: max,
						current_custom_domains_count: store.filter((domain) => domain.status !== 'released')
							.length
					}
				}
			}
		});
	});

	await page.route(/\/api\/v1\/app\/projects\/[^/]+\/domains(\/.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname;
		const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : null;
		calls.push({ method, path, body });
		if (!enabled) return fulfill(route, capturedDomain('domains-off'));
		if (role === 'viewer' && method !== 'GET') {
			return fulfill(route, capturedDomain('domain-create-viewer'));
		}
		const [, domainId, action] = path.match(/\/domains(?:\/([^/]+))?(?:\/([^/]+))?$/) ?? [];

		if (!domainId) {
			if (method === 'POST') {
				const hostname = String(body?.hostname ?? '');
				const refused = options.add?.(hostname);
				if (refused) return fulfill(route, refused);
				const domain = created(hostname, store.length);
				store.push(domain);
				return fulfill(route, { status: 201, body: { data: domain } });
			}
			return fulfill(route, { body: { data: store } });
		}
		const index = store.findIndex((domain) => domain.id === domainId);
		if (index === -1) return fulfill(route, capturedDomain('domains-off'));
		if (method === 'DELETE') {
			store.splice(index, 1);
			return fulfill(route, { status: 204 });
		}
		if (action === 'check') {
			const result = options.check?.(store[index]) ?? store[index];
			if ('id' in result) {
				store[index] = { ...result, id: domainId, project_id: PROJECT_ID };
				return fulfill(route, { body: { data: store[index] } });
			}
			return fulfill(route, result);
		}
		return fulfill(route, { body: { data: store[index] } });
	});

	return { calls, store };
}
