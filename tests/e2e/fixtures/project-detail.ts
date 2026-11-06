import type { Page, Route } from '@playwright/test';

export const PROJECT_ID = '01a0cd45-c5a6-7170-9f8d-8322191f231f';
export const DEPLOYMENT_ID = '01a0cd92-b2e0-7327-97a1-d688062f30fa';
export const NEW_DEPLOYMENT_ID = '01a0cd92-b2e0-7327-97a1-d688062f3999';
export const DETAIL_URL = `/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`;

export type LogLine = {
	sequence: number;
	stream: 'stdout' | 'stderr' | 'system';
	message: string;
	recorded_at: string;
};

export function logLine(
	sequence: number,
	message: string,
	stream: LogLine['stream'] = 'stdout'
): LogLine {
	const seconds = String(sequence % 60).padStart(2, '0');
	return { sequence, stream, message, recorded_at: `2026-09-20T08:41:${seconds}.000000Z` };
}

export function logPage(
	lines: LogLine[],
	cursors: { next?: string | null; prev?: string | null } = {}
) {
	return {
		data: lines,
		links: { first: null, last: null, prev: null, next: null },
		meta: {
			path: null,
			per_page: 10,
			next_cursor: cursors.next ?? null,
			prev_cursor: cursors.prev ?? null
		}
	};
}

const finishedAt = new Date().toISOString();
const startedAt = new Date(Date.now() - 47_000).toISOString();

const baseDeployment = {
	id: DEPLOYMENT_ID,
	project_id: PROJECT_ID,
	sequence: 3,
	branch: 'main',
	trigger: 'redeploy',
	commit_sha: 'a3f2c9d',
	commit_message: 'feat: something',
	image_reference: null,
	requested_resources: null,
	effective_resources: null,
	applied_resources: null,
	finalization_deferred: false,
	finalization_deferred_reason: null,
	agent_node_id: null,
	is_active: false,
	cancel_requested_at: null,
	queue_state: null,
	started_at: '2026-09-20T08:41:02Z',
	finished_at: null,
	cancelled_at: null,
	failure_code: null,
	failure_summary: null,
	failure: null,
	created_at: '2026-09-20T08:41:00Z',
	updated_at: '2026-09-20T08:41:49Z'
};

export const runningDeployment = { ...baseDeployment, status: 'building' };

export const queuedDeployment = {
	...baseDeployment,
	status: 'queued',
	started_at: null,
	queue_state: 'waiting_for_node'
};

export const succeededDeployment = {
	...baseDeployment,
	status: 'succeeded',
	is_active: true,
	started_at: startedAt,
	finished_at: finishedAt
};

export const failedDeployment = {
	...baseDeployment,
	status: 'failed',
	started_at: startedAt,
	finished_at: finishedAt,
	failure_code: 'runtime_build_failed',
	failure_summary: 'Proses build aplikasi berhenti sebelum selesai.',
	failure: {
		code: 'runtime_build_failed',
		category: 'build',
		summary: 'Proses build aplikasi berhenti sebelum selesai.',
		recovery_hint:
			'Buka log deployment untuk melihat error-nya, perbaiki di repository, lalu deploy ulang.',
		user_fixable: true,
		detail: 'npm ERR! code ELIFECYCLE',
		stage: 'building'
	}
};

/** The agent lost its node: nothing the user wrote caused this. */
export const platformFailureDeployment = {
	...baseDeployment,
	status: 'failed',
	started_at: startedAt,
	finished_at: finishedAt,
	failure_code: 'runtime_node_lost',
	failure_summary: 'Server Sakala berhenti saat deployment berjalan.',
	failure: {
		code: 'runtime_node_lost',
		category: 'node',
		summary: 'Server Sakala berhenti saat deployment berjalan.',
		recovery_hint: 'Ini bukan dari kode kamu. Coba deploy ulang.',
		user_fixable: false,
		detail: null,
		stage: 'deploying'
	}
};

export const cancelledDeployment = {
	...baseDeployment,
	status: 'cancelled',
	cancelled_at: finishedAt,
	finished_at: null
};

/** A failed deployment the API has no classified details for. */
export const failedWithoutDetails = {
	...baseDeployment,
	status: 'failed',
	started_at: startedAt,
	finished_at: finishedAt
};

export const unknownFailureDeployment = {
	...baseDeployment,
	status: 'failed',
	started_at: startedAt,
	finished_at: finishedAt,
	failure_code: 'something_new',
	failure_summary: 'Deployment berhenti karena kesalahan yang belum dikenali.',
	failure: {
		code: 'something_new',
		category: 'unknown',
		summary: 'Deployment berhenti karena kesalahan yang belum dikenali.',
		recovery_hint: 'Coba deploy ulang. Kalau gagal lagi, buka log deployment.',
		user_fixable: false,
		detail: null,
		stage: null
	}
};

export const baseProject = {
	id: PROJECT_ID,
	name: 'toko-kopi-web',
	project_name: 'toko-kopi-web',
	slug: 'toko-kopi-web',
	repository_provider: 'github',
	thumbnail_url: null,
	suspension: null,
	latest_deployment: null,
	repository_url: 'https://github.com/raniw/toko-kopi-web',
	repository_full_name: 'raniw/toko-kopi-web',
	repository_source: 'github_installation',
	github_installation_id: '123',
	github_repository_id: 456,
	branch: 'main',
	default_domain: 'toko-kopi-web.run.sakala.dev',
	public_url: 'https://toko-kopi-web.run.sakala.dev',
	status: 'active',
	runtime_status: 'running',
	detected_port: 3000,
	configured_port: null,
	effective_port: 3000,
	build_command: null,
	start_command: null,
	root_directory: null,
	auto_deploy: true,
	redeploy_required: false,
	active_deployment_id: DEPLOYMENT_ID,
	preview_status: 'ready',
	inspection: null,
	stack: null,
	last_deployed_at: '2026-09-20T08:41:49Z',
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-09-20T08:41:49Z'
};

export const events = [
	{
		sequence: 1,
		level: 'info',
		type: 'deployment.checkout.started',
		message: 'Cloning repository',
		// What the real API sends for an event without metadata: PHP encodes an empty map as a list.
		metadata: [],
		occurred_at: '2026-09-20T08:41:02Z'
	},
	{
		sequence: 2,
		level: 'info',
		type: 'deployment.build.started',
		message: 'Building image',
		metadata: null,
		occurred_at: '2026-09-20T08:41:20Z'
	}
];

export type JsonReply = { status?: number; body?: unknown; headers?: Record<string, string> };

export type ApiHandlers = {
	project?: () => unknown;
	deployment?: () => unknown;
	deploymentList?: () => unknown[];
	logs?: (url: URL) => JsonReply;
	events?: () => unknown[];
	updateProject?: (body: Record<string, unknown>) => JsonReply;
	deleteProject?: () => JsonReply;
	redeploy?: () => JsonReply;
	cancel?: () => JsonReply;
	updateEnv?: (body: Record<string, unknown>) => JsonReply;
	envList?: () => unknown[];
	addEnv?: (body: Record<string, unknown>) => JsonReply;
	deleteEnv?: () => JsonReply;
	revealEnv?: () => JsonReply;
};

function fulfill(route: Route, { status = 200, body, headers }: JsonReply) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({
		status,
		headers,
		contentType: 'application/json',
		body: JSON.stringify(body ?? {})
	});
}

export async function mockProjectApi(page: Page, handlers: ApiHandlers = {}) {
	await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));

	await page.route('**/api/v1/auth/user', (route) =>
		fulfill(route, {
			body: {
				data: {
					id: 1,
					name: 'Rani Wulandari',
					username: 'rani',
					email: 'rani@sakala.local',
					avatar_url: null,
					role: 'user',
					onboarding_source: 'github',
					onboarding_role: 'developer',
					onboarding_completed_at: '2026-01-01T00:00:00Z',
					last_login_at: '2026-01-01T00:00:00Z',
					has_password: true,
					legal_acceptance_required: false,
					pending_email: null,
					created_at: '2026-01-01T00:00:00Z'
				}
			}
		})
	);

	await page.route('**/api/v1/app/projects/**', (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;
		const method = request.method();
		const json = () => (request.postDataJSON() ?? {}) as Record<string, unknown>;

		if (/\/deployments\/[^/]+\/cancel\/?$/.test(path)) {
			return fulfill(
				route,
				handlers.cancel?.() ?? { status: 200, body: { data: cancelledDeployment } }
			);
		}
		if (/\/deployments\/[^/]+\/logs\/?$/.test(path)) {
			return fulfill(route, handlers.logs?.(url) ?? { body: logPage([]) });
		}
		if (/\/deployments\/[^/]+\/events\/?$/.test(path)) {
			return fulfill(route, { body: logPage((handlers.events?.() ?? events) as never) });
		}
		if (/\/deployments\/[^/]+\/?$/.test(path)) {
			return fulfill(route, { body: { data: handlers.deployment?.() ?? runningDeployment } });
		}
		if (/\/deployments\/?$/.test(path)) {
			if (method === 'POST') {
				return fulfill(
					route,
					handlers.redeploy?.() ?? {
						status: 201,
						body: { data: { ...runningDeployment, id: NEW_DEPLOYMENT_ID } }
					}
				);
			}
			const data = handlers.deploymentList?.() ?? [];
			return fulfill(route, {
				body: {
					data,
					meta: { current_page: 1, from: 1, last_page: 1, per_page: 6, to: 1, total: data.length }
				}
			});
		}
		if (/\/environment-variables\/[^/]+\/value\/?$/.test(path)) {
			return fulfill(route, handlers.revealEnv?.() ?? { body: { data: { value: 'rahasia' } } });
		}
		if (/\/environment-variables\/[^/]+\/?$/.test(path)) {
			if (method === 'PATCH') {
				return fulfill(
					route,
					handlers.updateEnv?.(json()) ?? {
						body: {
							data: {
								id: 1,
								key: 'X',
								is_secret: true,
								created_at: '2026-01-01T00:00:00Z',
								redeploy_required: true
							}
						}
					}
				);
			}
			return fulfill(route, handlers.deleteEnv?.() ?? { status: 204 });
		}
		if (/\/environment-variables\/?$/.test(path)) {
			if (method === 'POST') {
				return fulfill(
					route,
					handlers.addEnv?.(json()) ?? {
						status: 201,
						body: { data: { id: 'env_new', key: json().key, is_secret: true } }
					}
				);
			}
			return fulfill(route, { body: { data: handlers.envList?.() ?? [] } });
		}

		if (method === 'PUT') {
			return fulfill(
				route,
				handlers.updateProject?.(json()) ?? { body: { data: { ...baseProject, ...json() } } }
			);
		}
		if (method === 'DELETE') return fulfill(route, handlers.deleteProject?.() ?? { status: 204 });

		return fulfill(route, { body: { data: handlers.project?.() ?? baseProject } });
	});
}
