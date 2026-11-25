import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';
import { TEAM_WORKSPACE, workspaceProjects } from './databases';
import { baseProject, mockProjectApi, personalWorkspace, PROJECT_ID } from './project-detail';

/** Bodies captured from sakala-api main fc93ff9, #211 (tests/fixtures/valkeys). */
export function capturedValkey<T = unknown>(name: string): { status: number; body: T } {
	const file = new URL(`../../fixtures/valkeys/${name}.json`, import.meta.url);
	return JSON.parse(readFileSync(file, 'utf8')) as { status: number; body: T };
}

type ProjectRef = { id: string; name: string; slug: string };

export type MockValkey = {
	id: string;
	name: string;
	mode: string;
	status: string;
	region: string | null;
	maxmemory_mb: number;
	pending_maxmemory_mb: number | null;
	usage: {
		used_memory_bytes: number | null;
		evicted_keys: number | null;
		errorstat_oom: number | null;
		connected_clients: number | null;
		aof_last_write_status: string | null;
		container_status: string | null;
		restart_count: number | null;
		checked_at: string | null;
	};
	projects: ProjectRef[];
	connection: { host: string; port: number } | null;
	last_failure: Record<string, unknown> | null;
	password_rotation: {
		status: string;
		requested_at: string;
		completed_at: string | null;
		failed_at: string | null;
		redeploy_attached: boolean;
		redeploys:
			{ project_id: string; deployment_id: string | null; skipped_reason: string | null }[] | null;
	} | null;
	created_at: string | null;
	updated_at: string | null;
};

/** The deployment the mock API queues for an attached project after a password rotation. */
export const PASSWORD_ROTATION_DEPLOYMENT_ID = 'dep-valkey-rotation-1';

const MB = 1024 * 1024;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const show = (name: string) => capturedValkey<{ data: MockValkey }>(name).body.data;

/** The project of project-detail.ts, the one the queue store is attached to. */
export const attachedProject = { id: PROJECT_ID, name: baseProject.name, slug: baseProject.slug };

export const QUEUE_ID = show('valkey-show').id;

/** A persistent queue store attached to the project, 18 of 64 MB used. */
export function queueValkey(overrides: Partial<MockValkey> = {}): MockValkey {
	return {
		...show('valkey-show'),
		projects: [attachedProject],
		usage: { ...show('valkey-show').usage, checked_at: minutesAgo(1) },
		created_at: minutesAgo(60 * 24 * 2),
		...overrides
	};
}

/** A cache store at 27 of 32 MB, past the 80 % warning. */
export function cacheValkey(overrides: Partial<MockValkey> = {}): MockValkey {
	const captured = show('valkey-show-cache');
	return {
		...captured,
		id: 'valkey-cache',
		name: 'cache-katalog',
		projects: [{ id: 'p-kasir', name: 'api-kasir', slug: 'api-kasir' }],
		usage: { ...captured.usage, checked_at: minutesAgo(2) },
		created_at: minutesAgo(60 * 24),
		...overrides
	};
}

export function lockedValkey(): MockValkey {
	return {
		...show('valkey-show-locked'),
		id: 'valkey-locked',
		created_at: minutesAgo(60 * 24 * 5)
	};
}

export function provisioningValkey(): MockValkey {
	return {
		...show('valkey-create'),
		id: 'valkey-provisioning',
		name: 'sesi-web',
		created_at: minutesAgo(1)
	};
}

export function unknownRotationValkey(): MockValkey {
	return {
		...show('valkey-show-rotation-unknown'),
		id: 'valkey-unknown',
		projects: [attachedProject]
	};
}

/** The project's attached store, as the project resource names it. */
export function projectValkey(overrides: Record<string, unknown> = {}) {
	return {
		...(capturedValkey<{ data: { valkeys: Record<string, unknown>[] } }>('project-with-valkey').body
			.data.valkeys[0] ?? {}),
		id: QUEUE_ID,
		...overrides
	};
}

type JsonReply = { status?: number; body?: unknown };

export type ValkeyMockOptions = {
	valkeys?: MockValkey[];
	role?: 'owner' | 'member' | 'viewer';
	quota?: { max_valkeys: number; max_valkey_memory_mb: number };
	/** `valkeys.enabled` on pilot-limits (default true): the server's flag. */
	enabled?: boolean;
	/** `valkeys.available` on pilot-limits (default true). */
	available?: boolean;
	/** A new store turns ready after this many reads. */
	provisioningReads?: number;
	/** Answers POST .../valkeys instead of the store, for refusals. */
	create?: (body: Record<string, unknown>) => JsonReply | undefined;
	/** Answers POST .../attachments instead of the store, for refusals. */
	attach?: (valkeyId: string, projectId: string) => JsonReply | undefined;
	project?: Record<string, unknown>;
	envList?: unknown[];
	addEnv?: (body: Record<string, unknown>) => JsonReply;
	redeploy?: () => JsonReply;
};

function fulfill(route: Route, { status = 200, body }: JsonReply) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

export type ValkeyCalls = { method: string; path: string; body: unknown }[];

/**
 * The project mocks plus the Valkey endpoints, answered from an in-memory store so a create,
 * attach, detach, resize, rotation, or delete shows on the next read as the API would. While
 * `enabled` is false every Valkey endpoint answers 404, like the API with its flag off.
 */
export async function mockValkeyApi(
	page: Page,
	options: ValkeyMockOptions = {}
): Promise<{ calls: ValkeyCalls; store: MockValkey[] }> {
	const store = options.valkeys ?? [queueValkey(), cacheValkey()];
	const calls: ValkeyCalls = [];
	const role = options.role ?? 'owner';
	const enabled = options.enabled ?? true;
	const workspace = { ...TEAM_WORKSPACE, role };
	const quota = options.quota ?? { max_valkeys: 3, max_valkey_memory_mb: 256 };
	const reads = new Map<string, number>();
	let projectRedeployRequired = false;

	const attachedToProject = () =>
		store.filter((valkey) => valkey.projects.some((project) => project.id === PROJECT_ID));

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
			...(enabled
				? {
						valkeys: attachedToProject().map((valkey) =>
							projectValkey({
								id: valkey.id,
								name: valkey.name,
								mode: valkey.mode,
								status: valkey.status
							})
						)
					}
				: {}),
			redeploy_required: projectRedeployRequired,
			...options.project
		}),
		envList: () => options.envList ?? [],
		addEnv: options.addEnv,
		redeploy: options.redeploy
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
		const limits = capturedValkey<{
			data: Record<string, unknown> & { quotas: Record<string, unknown> };
		}>(enabled ? 'pilot-limits-valkeys' : 'pilot-limits-valkeys-off').body.data;
		const counted = store.filter((valkey) => valkey.status !== 'failed');
		return fulfill(route, {
			body: {
				data: {
					...limits,
					workspace_id: workspace.id,
					valkeys: {
						enabled,
						available: enabled && (options.available ?? true),
						sizes_mb: [32, 64, 128],
						default_size_mb: 64
					},
					quotas: {
						...limits.quotas,
						max_valkeys: quota.max_valkeys,
						current_valkeys_count: counted.length,
						max_valkey_memory_mb: quota.max_valkey_memory_mb,
						current_valkey_memory_mb: counted.reduce(
							(sum, valkey) =>
								sum + Math.max(valkey.maxmemory_mb, valkey.pending_maxmemory_mb ?? 0),
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
				databases: [],
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

	await page.route(/\/api\/v1\/app\/workspaces\/[^/]+\/valkeys(\/.*)?$/, (route) => {
		const request = route.request();
		const method = request.method();
		const path = new URL(request.url()).pathname;
		const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null;
		calls.push({ method, path, body });
		if (!enabled) return fulfill(route, capturedValkey('valkeys-off'));
		const [, valkeyId, action, projectId] =
			path.match(/\/valkeys(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/) ?? [];
		const valkey = store.find((item) => item.id === valkeyId);

		if (!valkeyId) {
			if (method === 'POST') {
				const refused = options.create?.(body ?? {});
				if (refused) return fulfill(route, refused);
				const project = [attachedProject, ...workspaceProjects].find(
					(item) => item.id === body?.project_id
				);
				const created: MockValkey = {
					...show('valkey-create'),
					id: `valkey-new-${store.length}`,
					name: String(body?.name ?? project?.name),
					mode: String(body?.mode),
					maxmemory_mb: Number(body?.maxmemory_mb ?? 64),
					region: (body?.region as string | null) ?? 'jkt',
					projects: project ? [project] : [],
					created_at: new Date().toISOString()
				};
				store.unshift(created);
				if (project?.id === PROJECT_ID) projectRedeployRequired = true;
				return fulfill(route, { status: 201, body: { data: created } });
			}
			return fulfill(route, { body: { data: store } });
		}
		if (!valkey) return fulfill(route, capturedValkey('valkeys-off'));

		if (action === 'credentials') {
			if (role !== 'owner') return fulfill(route, capturedValkey('credentials-member'));
			if (valkey.password_rotation?.status === 'unknown') {
				return fulfill(route, capturedValkey('credentials-password-rotating'));
			}
			return fulfill(route, capturedValkey('credentials'));
		}
		if (action === 'rotate-password') {
			valkey.password_rotation = {
				status: 'pending',
				requested_at: new Date().toISOString(),
				completed_at: null,
				failed_at: null,
				redeploy_attached: body?.redeploy_attached === true,
				redeploys: null
			};
			valkey.last_failure = null;
			return fulfill(route, { status: 202, body: { data: valkey } });
		}
		if (action === 'attachments' && projectId) {
			const project = [attachedProject, ...workspaceProjects].find(
				(item) => item.id === projectId
			)!;
			if (method === 'DELETE') {
				valkey.projects = valkey.projects.filter((item) => item.id !== projectId);
				if (projectId === PROJECT_ID) projectRedeployRequired = true;
				return fulfill(route, { status: 204 });
			}
			const refused = options.attach?.(valkey.id, projectId);
			if (refused) return fulfill(route, refused);
			valkey.projects = [...valkey.projects, project];
			if (projectId === PROJECT_ID) projectRedeployRequired = true;
			return fulfill(route, {
				status: 201,
				body: {
					data: {
						valkey_id: valkey.id,
						project,
						redeploy_required: true,
						attached_at: new Date().toISOString()
					}
				}
			});
		}
		if (method === 'PATCH') {
			if (typeof body?.name === 'string') valkey.name = body.name;
			if (typeof body?.maxmemory_mb === 'number') {
				valkey.pending_maxmemory_mb = body.maxmemory_mb;
				return fulfill(route, { status: 202, body: { data: valkey } });
			}
			return fulfill(route, { body: { data: valkey } });
		}
		if (method === 'DELETE') {
			if (valkey.projects.length > 0) {
				return fulfill(route, {
					status: 409,
					body: {
						...capturedValkey<object>('valkey-delete-in-use').body,
						projects: valkey.projects
					}
				});
			}
			valkey.status = 'deleting';
			return fulfill(route, { status: 202, body: { data: valkey } });
		}

		// A rotation completes on the next read, and the attached projects get a redeploy.
		if (valkey.password_rotation?.status === 'pending') {
			valkey.password_rotation.status = 'completed';
			valkey.password_rotation.completed_at = new Date().toISOString();
			valkey.password_rotation.redeploys = valkey.password_rotation.redeploy_attached
				? valkey.projects.map((project) => ({
						project_id: project.id,
						deployment_id: PASSWORD_ROTATION_DEPLOYMENT_ID,
						skipped_reason: null
					}))
				: null;
		}
		// A resize lands on the next read.
		if (valkey.pending_maxmemory_mb !== null) {
			valkey.maxmemory_mb = valkey.pending_maxmemory_mb;
			valkey.pending_maxmemory_mb = null;
		}
		if (valkey.status === 'provisioning' && options.provisioningReads !== undefined) {
			const seen = (reads.get(valkey.id) ?? 0) + 1;
			reads.set(valkey.id, seen);
			if (seen > options.provisioningReads) {
				const ready = show('valkey-show');
				valkey.status = 'ready';
				valkey.connection = ready.connection;
				valkey.usage = {
					...ready.usage,
					used_memory_bytes: 1 * MB,
					checked_at: new Date().toISOString()
				};
			}
		}
		return fulfill(route, { body: { data: valkey } });
	});

	return { calls, store };
}
