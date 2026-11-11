import type { Page, Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Responses the merged sakala-api sent for its own factory data, captured once (see
 * `src/lib/api/resources/admin/admin.spec.ts`). The mock serves them by path, so every admin page
 * renders the real shapes, including PHP's `[]` for empty maps.
 */
type Fixture = { status: number; body: Record<string, unknown> };

const dir = fileURLToPath(new URL('../../fixtures/admin/', import.meta.url));

export function adminFixture(name: string): Fixture {
	return JSON.parse(readFileSync(`${dir}${name}.json`, 'utf8')) as Fixture;
}

type Data<T = Record<string, unknown>> = { data: T };

export const ids = {
	user: String((adminFixture('user-detail').body as Data<{ user: { id: number } }>).data.user.id),
	workspace: (adminFixture('workspace-detail').body as Data<{ workspace: { id: string } }>).data
		.workspace.id,
	project: (adminFixture('project-detail').body as Data<{ project: { id: string } }>).data.project
		.id,
	suspendedProject: (
		adminFixture('project-detail-suspended').body as Data<{ project: { id: string } }>
	).data.project.id,
	deployment: (adminFixture('deployment-detail').body as Data<{ deployment: { id: string } }>).data
		.deployment.id,
	agent: (adminFixture('agent-detail').body as Data<{ id: string }>).data.id,
	command: (adminFixture('agent-command').body as Data<{ id: string }>).data.id,
	limitProfile: (adminFixture('limit-profiles').body as Data<{ id: string }[]>).data[0].id,
	feedback: (adminFixture('feedback').body as Data<{ id: string }[]>).data[0].id
};

export type RecordedCall = {
	method: string;
	path: string;
	search: URLSearchParams;
	body: unknown;
	headers: Record<string, string>;
};

function fulfill(route: Route, fixture: Fixture | { status: number; body: unknown }) {
	return route.fulfill({
		status: fixture.status,
		contentType: 'application/json',
		body: fixture.status === 204 ? '' : JSON.stringify(fixture.body)
	});
}

/** The current user, as `GET auth/user` returns it, with the role under test. */
export function currentUser(role: 'admin' | 'user') {
	const user = (adminFixture('current-user').body as Data).data;
	return { ...user, role, onboarding_completed_at: '2026-01-01T00:00:00+00:00' };
}

type Options = {
	role?: 'admin' | 'user';
	/** Answers a path before the defaults do; return undefined to fall through. */
	override?: (call: RecordedCall) => Fixture | { status: number; body: unknown } | undefined;
};

/** Mocks the signed-in user and every admin endpoint. Returns the admin calls, in order. */
export async function mockAdminApi(page: Page, { role = 'admin', override }: Options = {}) {
	const calls: RecordedCall[] = [];

	await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
	await page.route('**/api/v1/auth/user', (route) =>
		fulfill(route, { status: 200, body: { data: currentUser(role) } })
	);
	await page.route(/\/api\/v1\/admin\//, (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname.replace(/^.*\/api\/v1\/admin\//, '');
		const call: RecordedCall = {
			method: request.method(),
			path,
			search: url.searchParams,
			body: request.postData() ? request.postDataJSON() : null,
			headers: request.headers()
		};
		calls.push(call);

		if (role !== 'admin') return fulfill(route, adminFixture('forbidden'));
		const custom = override?.(call);
		if (custom) return fulfill(route, custom);
		return fulfill(route, defaultResponse(call));
	});

	return calls;
}

function defaultResponse({ method, path, search }: RecordedCall): Fixture {
	const segments = path.split('/');
	const [resource, id, sub] = segments;
	const get = method === 'GET';

	switch (resource) {
		case 'overview':
			return adminFixture(search.get('range') === 'custom' ? 'overview-custom' : 'overview');
		case 'users':
			if (!id) return adminFixture('users');
			if (!sub) return adminFixture('user-detail');
			if (sub === 'role') return adminFixture('user-role');
			if (sub === 'team-limit') return adminFixture('user-team-limit');
			return adminFixture('user-limit-profile');
		case 'workspaces':
			if (!id) return adminFixture('workspaces');
			return adminFixture(sub ? 'workspace-limit-profile' : 'workspace-detail');
		case 'limit-profiles':
			if (!id) return adminFixture(get ? 'limit-profiles' : 'limit-profile-create');
			if (method === 'DELETE') return adminFixture('limit-profile-delete-in-use');
			return adminFixture('limit-profile-update');
		case 'projects':
			if (!id) return adminFixture('projects');
			if (sub) return adminFixture(`project-${sub}`);
			return adminFixture(
				id === ids.suspendedProject ? 'project-detail-suspended' : 'project-detail'
			);
		case 'deployments':
			if (id === 'failures') return adminFixture('failures');
			if (id === 'failure-summary') {
				return adminFixture(
					search.get('range') === 'all' ? 'failure-summary-all' : 'failure-summary'
				);
			}
			if (sub === 'events') return adminFixture('deployment-events');
			if (sub === 'logs') return adminFixture('deployment-logs');
			return adminFixture('deployment-detail');
		case 'agents':
			if (!id) return adminFixture(get ? 'agents' : 'agent-provision');
			if (sub === 'rotate') return adminFixture('agent-rotate');
			if (sub === 'revoke') return adminFixture('agent-revoke');
			if (sub === 'commands') return adminFixture(segments[3] ? 'agent-command' : 'agent-commands');
			return adminFixture('agent-detail');
		case 'feedback':
			return adminFixture(id ? 'feedback-update' : 'feedback');
		case 'audit-events':
			return adminFixture('audit-events');
		default:
			return { status: 404, body: { message: 'Not Found' } };
	}
}

export const ADMIN_ROUTES = [
	['admin-overview', '/admin'],
	['admin-users', '/admin/users'],
	['admin-user', `/admin/users/${ids.user}`],
	['admin-workspaces', '/admin/workspaces'],
	['admin-workspace', `/admin/workspaces/${ids.workspace}`],
	['admin-limit-profiles', '/admin/limit-profiles'],
	['admin-projects', '/admin/projects'],
	['admin-project', `/admin/projects/${ids.project}`],
	['admin-project-suspended', `/admin/projects/${ids.suspendedProject}`],
	['admin-failures', '/admin/failures'],
	['admin-deployment', `/admin/deployments/${ids.deployment}`],
	['admin-agents', '/admin/agents'],
	['admin-agent', `/admin/agents/${ids.agent}`],
	['admin-feedback', '/admin/feedback'],
	['admin-audit', '/admin/audit']
] as const;
