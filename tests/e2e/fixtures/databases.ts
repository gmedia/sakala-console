import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { baseProject, mockProjectApi, personalWorkspace, PROJECT_ID } from './project-detail';

/** Bodies captured from sakala-api (tests/fixtures/databases). */
export function capturedDatabase<T = unknown>(name: string): { status: number; body: T } {
	const file = new URL(`../../fixtures/databases/${name}.json`, import.meta.url);
	return JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: T };
}

export type MockDatabase = {
	id: string;
	name: string;
	engine: string;
	status: string;
	region: string | null;
	size_bytes: number | null;
	size_checked_at: string | null;
	projects: { id: string; name: string; slug: string }[];
	last_failure: {
		command: string;
		code: string;
		user_fixable: boolean;
		summary: string;
		failed_at: string | null;
	} | null;
	created_at: string | null;
	updated_at: string | null;
};

const MB = 1024 * 1024;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const captured = capturedDatabase<{ data: MockDatabase[] }>('databases').body.data;
const capturedReady = captured.find((database) => database.projects.length > 0)!;
const capturedLocked = captured.find((database) => database.status === 'locked')!;
const capturedFailed = captured.find((database) => database.status === 'failed')!;
const capturedExtension = captured.find((database) => database.name === 'analitik')!;

export const DATABASE_ID = capturedReady.id;
export const LOCKED_DATABASE_ID = capturedLocked.id;

/** The project of project-detail.ts, the one the captured database is attached to. */
export const attachedProject = { id: PROJECT_ID, name: baseProject.name, slug: baseProject.slug };

/** The captured list, re-homed to the e2e workspace and project, with room left in the quota. */
export function sampleDatabases(): MockDatabase[] {
	return [
		{
			...capturedReady,
			projects: [attachedProject],
			size_checked_at: minutesAgo(3),
			created_at: minutesAgo(60 * 24 * 3)
		},
		{
			...capturedExtension,
			projects: [reportProject],
			size_checked_at: minutesAgo(3),
			created_at: minutesAgo(60 * 24 * 2)
		},
		{ ...capturedFailed, created_at: minutesAgo(60) }
	];
}

/** The captured locked database, 500 MB, which only happens once the workspace's storage is full. */
export function lockedDatabase(): MockDatabase {
	return {
		...capturedLocked,
		// Alone it must fill the 512 MB quota, as the captured workspace's three databases did.
		size_bytes: 520 * MB,
		size_checked_at: minutesAgo(3),
		created_at: minutesAgo(60 * 24 * 7)
	};
}

/** A database the node is still creating. */
export function provisioningDatabase(): MockDatabase {
	return {
		...capturedDatabase<{ data: MockDatabase }>('database-create').body.data,
		id: 'db-provisioning',
		name: 'kasir-db',
		created_at: minutesAgo(1)
	};
}

/** Projects of the workspace the attach dialog lists, at most six a page like the API. */
/** A project that already uses the other database, analitik. */
export const reportProject = { id: 'p-laporan', name: 'laporan-web', slug: 'laporan-web' };

export const workspaceProjects = [
	attachedProject,
	{ id: 'p-kasir', name: 'api-kasir', slug: 'api-kasir' },
	{ id: 'p-admin', name: 'panel-admin', slug: 'panel-admin' },
	reportProject
];

type JsonReply = { status?: number; body?: unknown };

export type DatabaseHandlers = {
	/** Answers POST .../databases instead of the store, for refusals. */
	create?: (body: Record<string, unknown>) => JsonReply | undefined;
	attach?: (projectId: string) => JsonReply | undefined;
	delete?: (database: MockDatabase) => JsonReply | undefined;
	rotate?: () => JsonReply | undefined;
	extension?: (extension: string) => JsonReply | undefined;
};

export type DatabaseMockOptions = {
	databases?: MockDatabase[];
	/** The caller's role in the personal workspace's stead: a team with this role is active. */
	role?: 'owner' | 'member' | 'viewer';
	quota?: { max_databases: number; max_database_storage_mb: number };
	/** A database the API reports as `provisioning` this many reads before it turns `ready`. */
	provisioningReads?: number;
	handlers?: DatabaseHandlers;
	/** The project resource the project pages read. */
	project?: Record<string, unknown>;
	envList?: unknown[];
};

export const TEAM_WORKSPACE = {
	id: '01a1cb4a-de55-72db-b810-80611beec465',
	name: 'Tim Facility',
	slug: 'tim-facility',
	type: 'team',
	limit_profile: { id: 'lp-1', name: 'Magang GMEDIA' },
	default_region: 'jkt',
	projects_count: 3,
	active_deployments_count: 0,
	created_at: '2026-01-01T00:00:00+00:00'
};

function fulfill(route: Route, { status = 200, body }: JsonReply) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Every call the mock received, for asserting what the Console sent. */
export type DatabaseCalls = { method: string; path: string; body: unknown }[];

/**
 * The project mocks plus the database endpoints, answered from an in-memory store so a create,
 * attach, detach, or delete shows on the next read the way the API would.
 */
export async function mockDatabaseApi(
	page: Page,
	options: DatabaseMockOptions = {}
): Promise<{ calls: DatabaseCalls; store: MockDatabase[] }> {
	const store = options.databases ?? sampleDatabases();
	const calls: DatabaseCalls = [];
	const workspace =
		options.role && options.role !== 'owner'
			? { ...TEAM_WORKSPACE, role: options.role }
			: options.role === 'owner'
				? { ...TEAM_WORKSPACE, role: 'owner' }
				: { ...personalWorkspace, projects_count: 3, active_deployments_count: 0 };
	const quota = options.quota ?? { max_databases: 3, max_database_storage_mb: 512 };
	const reads = new Map<string, number>();

	await mockProjectApi(page, {
		project: () => ({
			...baseProject,
			workspace: {
				id: workspace.id,
				name: workspace.name,
				slug: workspace.slug,
				type: workspace.type
			},
			...options.project
		}),
		envList: () => options.envList ?? []
	});

	await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
		fulfill(route, {
			body: {
				data: [
					{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 },
					...(workspace.type === 'team' ? [workspace] : [])
				]
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
		const limits = capturedDatabase<{ data: Record<string, unknown> & { quotas: object } }>(
			'pilot-limits-databases'
		).body.data;
		const live = store.filter((database) => database.status !== 'failed');
		return fulfill(route, {
			body: {
				data: {
					...limits,
					workspace_id: workspace.id,
					quotas: {
						...limits.quotas,
						max_databases: quota.max_databases,
						current_databases_count: live.length,
						max_database_storage_mb: quota.max_database_storage_mb,
						current_database_storage_bytes: store.reduce(
							(sum, database) => sum + (database.size_bytes ?? 0),
							0
						)
					}
				}
			}
		});
	});
	await page.route('**/api/v1/app/regions', (route) =>
		fulfill(route, { body: { data: [{ slug: 'jkt' }, { slug: 'sby' }] } })
	);
	await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) => {
		const url = new URL(route.request().url());
		const search = url.searchParams.get('search')?.toLowerCase() ?? '';
		const data = workspaceProjects
			.filter((project) => project.name.includes(search))
			.map((project) => ({
				...baseProject,
				id: project.id,
				name: project.name,
				slug: project.slug,
				public_url: `https://${project.slug}.sakala.app`,
				latest_deployment: null,
				// The light version the list carries, from the store so attaching shows at once.
				databases: store
					.filter((database) => database.projects.some((item) => item.id === project.id))
					.map(({ id, name, status }) => ({ id, name, status })),
				workspace: {
					id: workspace.id,
					name: workspace.name,
					slug: workspace.slug,
					type: workspace.type
				}
			}));
		return fulfill(route, {
			body: {
				data,
				links: { first: null, last: null, prev: null, next: null },
				meta: {
					current_page: 1,
					from: data.length ? 1 : null,
					last_page: 1,
					links: [],
					path: null,
					per_page: 6,
					to: data.length,
					total: data.length
				}
			}
		});
	});

	await page.route(/\/api\/v1\/app\/workspaces\/[^/]+\/databases(\/.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname;
		const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null;
		calls.push({ method, path, body });
		const [, databaseId, action, projectId] =
			path.match(/\/databases(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/) ?? [];
		const database = store.find((item) => item.id === databaseId);

		if (!databaseId) {
			if (method === 'POST') {
				const refused = options.handlers?.create?.(body ?? {});
				if (refused) return fulfill(route, refused);
				const created: MockDatabase = {
					...capturedDatabase<{ data: MockDatabase }>('database-create').body.data,
					id: `db-new-${store.length}`,
					name: String(body?.name),
					region: (body?.region as string | null) ?? 'jkt',
					created_at: new Date().toISOString()
				};
				store.unshift(created);
				return fulfill(route, { status: 201, body: { data: created } });
			}
			return fulfill(route, { body: { data: store } });
		}
		if (!database) {
			return fulfill(route, { status: 404, body: { message: 'Not found.' } });
		}

		if (action === 'credentials') {
			if (workspace.role !== 'owner') {
				return fulfill(route, capturedDatabase('credentials-member'));
			}
			return fulfill(route, capturedDatabase('credentials'));
		}
		if (action === 'rotate-password') {
			const refused = options.handlers?.rotate?.();
			if (refused) return fulfill(route, refused);
			return fulfill(route, { status: 202, body: { data: database } });
		}
		if (action === 'extensions') {
			const refused = options.handlers?.extension?.(String(body?.extension));
			if (refused) return fulfill(route, refused);
			return fulfill(route, { status: 202, body: { data: database } });
		}
		if (action === 'attachments' && projectId) {
			const project = workspaceProjects.find((item) => item.id === projectId)!;
			if (method === 'DELETE') {
				database.projects = database.projects.filter((item) => item.id !== projectId);
				return fulfill(route, { status: 204 });
			}
			const refused = options.handlers?.attach?.(projectId);
			if (refused) return fulfill(route, refused);
			database.projects = [...database.projects, project];
			return fulfill(route, {
				status: 201,
				body: {
					data: {
						database_id: database.id,
						project,
						redeploy_required: true,
						attached_at: new Date().toISOString()
					}
				}
			});
		}

		if (method === 'PATCH') {
			database.name = String(body?.name);
			return fulfill(route, { body: { data: database } });
		}
		if (method === 'DELETE') {
			const refused = options.handlers?.delete?.(database);
			if (refused) return fulfill(route, refused);
			if (database.projects.length > 0) {
				return fulfill(route, {
					status: 409,
					body: {
						...capturedDatabase<object>('database-delete-in-use').body,
						projects: database.projects
					}
				});
			}
			database.status = 'deleting';
			return fulfill(route, { status: 202, body: { data: database } });
		}

		// A new database turns ready after a few reads, like a node reporting back.
		if (database.status === 'provisioning' && options.provisioningReads !== undefined) {
			const seen = (reads.get(database.id) ?? 0) + 1;
			reads.set(database.id, seen);
			if (seen > options.provisioningReads) {
				database.status = 'ready';
				database.size_bytes = 7.5 * MB;
				database.size_checked_at = new Date().toISOString();
			}
		}
		return fulfill(route, { body: { data: database } });
	});

	return { calls, store };
}
