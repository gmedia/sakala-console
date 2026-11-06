import type { Page, Route } from '@playwright/test';
import { DEPLOYMENT_ID, PROJECT_ID, mockProjectApi, runningDeployment } from './project-detail';

export { DEPLOYMENT_ID, PROJECT_ID };

export type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

export const INSTALLATIONS = [
	{
		id: '01a0cd45-0000-7170-9f8d-000000000001',
		account_login: 'rani',
		account_type: 'User',
		repository_selection: 'all',
		status: 'active',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z'
	},
	{
		id: '01a0cd45-0000-7170-9f8d-000000000002',
		account_login: 'kopi-org',
		account_type: 'Organization',
		repository_selection: 'selected',
		status: 'active',
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z'
	}
];

export function repository(index: number, owner = 'rani') {
	return {
		id: 1000 + index,
		name: `repo-${index}`,
		full_name: `${owner}/repo-${index}`,
		clone_url: `https://github.com/${owner}/repo-${index}.git`,
		default_branch: 'main',
		pushed_at: '2026-09-20T00:00:00Z',
		private: index % 2 === 0
	};
}

/** Behaves like the API: pages and searches on the server, and reports the true total. */
export function repositoryPage(all: ReturnType<typeof repository>[], url: URL) {
	const search = (url.searchParams.get('search') ?? '').toLowerCase();
	const page = Number(url.searchParams.get('page') ?? 1);
	const perPage = Number(url.searchParams.get('per_page') ?? 30);
	const matches = all.filter((repo) => repo.full_name.toLowerCase().includes(search));
	return {
		data: matches.slice((page - 1) * perPage, page * perPage),
		links: { first: null, last: null, prev: null, next: null },
		meta: {
			current_page: page,
			from: null,
			last_page: Math.max(1, Math.ceil(matches.length / perPage)),
			links: [],
			path: null,
			per_page: perPage,
			to: null,
			total: matches.length
		}
	};
}

export const pilotLimits = {
	quotas: {
		max_projects_per_user: 3,
		max_active_deployments_per_user: 2,
		max_active_deployments_per_project: 1,
		current_projects_count: 1,
		current_active_deployments_count: 0
	},
	runtime_defaults: { memory_mb: 256, cpu_millis: 500, pids_limit: 128 },
	runtime_maximums: { memory_mb: 512, cpu_millis: 1000, pids_limit: 256 },
	timeouts: {
		build_timeout_seconds: 600,
		start_timeout_seconds: 120,
		command_timeout_seconds: 900
	},
	log_bounds: {
		max_line_length: 4096,
		max_batch_lines: 500,
		max_total_bytes: 10485760,
		max_request_bytes: 1048576
	}
};

export const createdProject = {
	id: PROJECT_ID,
	name: 'repo-1',
	slug: 'repo-1',
	repository_provider: 'github',
	thumbnail_url: null,
	repository_url: 'https://github.com/rani/repo-1',
	repository_full_name: 'rani/repo-1',
	repository_source: 'github_installation',
	github_installation_id: INSTALLATIONS[0].id,
	github_repository_id: 1001,
	branch: 'develop',
	default_domain: 'repo-1.apps.example.test',
	public_url: 'https://repo-1.apps.example.test',
	status: 'draft',
	runtime_status: 'not_deployed',
	detected_port: null,
	configured_port: null,
	effective_port: 3000,
	build_command: null,
	start_command: null,
	root_directory: null,
	auto_deploy: false,
	redeploy_required: false,
	active_deployment_id: null,
	preview_status: 'pending',
	inspection: null,
	stack: null,
	inspection_error_code: null,
	last_deployed_at: null,
	created_at: '2026-11-06T00:00:00Z',
	updated_at: '2026-11-06T00:00:00Z'
};

export const succeededInspection = {
	preview_status: 'succeeded',
	inspection: {
		repository_url: 'https://github.com/rani/repo-1',
		commit_sha: '0123456789abcdef',
		dockerfile_found: true,
		env_example_found: true,
		compose_found: false,
		manifests: ['Dockerfile', 'package.json'],
		package_manager: 'pnpm',
		inspected_at: '2026-11-06T00:00:10Z'
	},
	stack: { builder: 'dockerfile', provider: 'node', framework: null, package_manager: 'pnpm' }
};

export type WizardApi = {
	installations?: () => Reply;
	repositories?: (installationId: string, url: URL) => Reply;
	branches?: (url: URL) => Reply;
	validate?: (body: Record<string, unknown>) => Reply;
	publicBranches?: (url: URL) => Reply;
	domainPreview?: (url: URL) => Reply;
	pilotLimits?: () => Reply;
	createProject?: (body: Record<string, unknown>) => Reply;
	addEnv?: (body: Record<string, unknown>) => Reply;
	envList?: () => unknown[];
	/** Called on every GET of the project, which is what the wizard polls. */
	project?: () => unknown;
	inspect?: () => Reply;
	deploy?: (body: Record<string, unknown>, headers: Record<string, string>) => Reply;
	feedback?: (body: Record<string, unknown>) => Reply;
};

function fulfill(route: Route, reply: Reply) {
	return route.fulfill({
		status: reply.status ?? 200,
		headers: reply.headers,
		contentType: 'application/json',
		body: JSON.stringify(reply.body ?? {})
	});
}

export type WizardCalls = {
	createProject: Record<string, unknown>[];
	addEnv: Record<string, unknown>[];
	deploy: { body: Record<string, unknown>; headers: Record<string, string> }[];
	inspect: number;
	repositories: URL[];
	branches: URL[];
	domainPreview: string[];
};

/** Everything the wizard calls, answered like the API does. Returns what was asked. */
export async function mockWizardApi(page: Page, api: WizardApi = {}): Promise<WizardCalls> {
	const calls: WizardCalls = {
		createProject: [],
		addEnv: [],
		deploy: [],
		inspect: 0,
		repositories: [],
		branches: [],
		domainPreview: []
	};

	await mockProjectApi(page, {
		project: () => api.project?.() ?? createdProject,
		deployment: () => ({ ...runningDeployment, id: DEPLOYMENT_ID, project_id: PROJECT_ID }),
		envList: api.envList,
		deploymentList: () => []
	});

	// Registered after mockProjectApi, so these win over its catch-all for the project routes.
	await page.route('**/api/v1/app/pilot-limits', (route) =>
		fulfill(route, api.pilotLimits?.() ?? { body: { data: pilotLimits } })
	);

	await page.route('**/api/v1/app/github/**', (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const path = url.pathname;

		if (path.endsWith('/github/installations')) {
			return fulfill(route, api.installations?.() ?? { body: { data: INSTALLATIONS } });
		}
		const branches = path.match(/\/installations\/[^/]+\/repositories\/\d+\/branches$/);
		if (branches) {
			calls.branches.push(url);
			return fulfill(
				route,
				api.branches?.(url) ?? {
					body: { data: [{ name: 'main' }, { name: 'develop' }, { name: 'feat/checkout' }] }
				}
			);
		}
		const repositories = path.match(/\/installations\/([^/]+)\/repositories$/);
		if (repositories) {
			calls.repositories.push(url);
			return fulfill(
				route,
				api.repositories?.(repositories[1], url) ?? {
					body: repositoryPage(
						Array.from({ length: 12 }, (_, i) => repository(i + 1)),
						url
					)
				}
			);
		}
		if (path.endsWith('/repositories/validate')) {
			const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
			return fulfill(
				route,
				api.validate?.(body) ?? {
					body: {
						data: {
							...repository(7, 'publik'),
							name: 'situs',
							full_name: 'publik/situs',
							clone_url: 'https://github.com/publik/situs.git',
							default_branch: 'trunk'
						}
					}
				}
			);
		}
		if (path.endsWith('/repositories/branches')) {
			calls.branches.push(url);
			return fulfill(
				route,
				api.publicBranches?.(url) ?? {
					body: { data: [{ name: 'trunk' }, { name: 'gh-pages' }] }
				}
			);
		}
		return route.fallback();
	});

	await page.route('**/api/v1/app/projects/domain-preview**', (route) => {
		const url = new URL(route.request().url());
		const name = url.searchParams.get('name') ?? '';
		calls.domainPreview.push(name);
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
		return fulfill(
			route,
			api.domainPreview?.(url) ?? {
				body: { data: { slug, domain: `${slug}-2.apps.example.test` } }
			}
		);
	});

	await page.route(/\/api\/v1\/app\/projects\/?$/, (route) => {
		const request = route.request();
		if (request.method() !== 'POST') return route.fallback();
		const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
		calls.createProject.push(body);
		return fulfill(
			route,
			api.createProject?.(body) ?? { status: 201, body: { data: { ...createdProject, ...body } } }
		);
	});

	await page.route(`**/api/v1/app/projects/${PROJECT_ID}/inspection`, (route) => {
		calls.inspect += 1;
		return fulfill(
			route,
			api.inspect?.() ?? {
				status: 202,
				body: { data: { ...createdProject, preview_status: 'pending' } }
			}
		);
	});

	await page.route(`**/api/v1/app/projects/${PROJECT_ID}/environment-variables`, (route) => {
		const request = route.request();
		if (request.method() !== 'POST') return route.fallback();
		const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
		calls.addEnv.push(body);
		return fulfill(
			route,
			api.addEnv?.(body) ?? { status: 201, body: { data: { id: calls.addEnv.length, ...body } } }
		);
	});

	await page.route(`**/api/v1/app/projects/${PROJECT_ID}/deployments`, (route) => {
		const request = route.request();
		if (request.method() !== 'POST') return route.fallback();
		const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
		const headers = request.headers();
		calls.deploy.push({ body, headers });
		return fulfill(
			route,
			api.deploy?.(body, headers) ?? {
				status: 201,
				body: { data: { ...runningDeployment, id: DEPLOYMENT_ID, project_id: PROJECT_ID } }
			}
		);
	});

	await page.route('**/api/v1/app/feedback', (route) => {
		const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
		return fulfill(
			route,
			api.feedback?.(body) ?? {
				status: 201,
				body: { data: { id: 'f-1', ...body, created_at: '2026-11-06T00:00:00Z' } }
			}
		);
	});

	return calls;
}
