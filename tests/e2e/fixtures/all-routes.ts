import type { Page, Route } from '@playwright/test';
import { DEPLOYMENT_ID, PROJECT_ID, mockWizardApi } from './create-project';
import { baseProject, failedDeployment, succeededDeployment } from './project-detail';

// A word with no break opportunity, the longest thing real data throws at a layout.
export const LONG = 'sangat-panjang-tanpa-spasi-'.repeat(8);

const longCommit = `fix(${LONG}): ${LONG} perbaiki halaman checkout yang gagal memuat`;

export const signedInUser = {
	id: 1,
	name: 'Rani Wulandari',
	username: 'rani',
	email: 'rani@sakala.local',
	avatar_url: null as string | null,
	role: 'user',
	onboarding_source: 'github',
	onboarding_role: 'developer',
	onboarding_completed_at: '2026-01-01T00:00:00Z' as string | null,
	last_login_at: '2026-01-01T00:00:00Z',
	has_password: true,
	pending_email: null as string | null,
	created_at: '2026-01-01T00:00:00Z'
};

function json(route: Route, body: unknown, status = 200) {
	return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function listMeta(total: number) {
	return {
		current_page: 1,
		from: 1,
		last_page: 3,
		links: [],
		path: null,
		per_page: 6,
		to: total,
		total: total * 3
	};
}

/** Every endpoint the signed-in console calls, filled with ordinary or very long content. */
export async function mockEveryRoute(page: Page, { long = false }: { long?: boolean } = {}) {
	const name = long ? `toko-${LONG}` : 'toko-kopi-web';
	const email = long ? `${LONG}@sakala.local` : signedInUser.email;
	const commit = long ? longCommit : 'feat: tambah halaman menu';
	const repository = long ? `rani/${LONG}` : 'raniw/toko-kopi-web';

	const project = {
		...baseProject,
		name,
		project_name: name,
		slug: name,
		repository_full_name: repository,
		repository_url: `https://github.com/${repository}`,
		default_domain: `${name}.apps.example.test`,
		public_url: `https://${name}.apps.example.test`,
		build_command: long ? `npm run ${LONG}` : null
	};
	const deployment = {
		...failedDeployment,
		id: DEPLOYMENT_ID,
		project_id: PROJECT_ID,
		branch: long ? `feat/${LONG}` : 'main',
		commit_message: commit
	};
	const deployments = [
		deployment,
		{
			...succeededDeployment,
			id: 'dep-2',
			project_id: PROJECT_ID,
			sequence: 2,
			branch: deployment.branch,
			commit_message: commit
		}
	];

	await mockWizardApi(page, {
		project: () => project,
		envList: () => [
			{
				id: 'env-1',
				key: long ? LONG.toUpperCase().replaceAll('-', '_') : 'DATABASE_URL',
				is_secret: true,
				created_at: '2026-01-01T00:00:00Z',
				updated_at: '2026-01-01T00:00:00Z'
			}
		],
		repositories: (_installation, url) => ({
			body: {
				data: [1, 2, 3].map((index) => ({
					id: 1000 + index,
					name: long ? `${LONG}${index}` : `repo-${index}`,
					full_name: long ? `rani/${LONG}${index}` : `rani/repo-${index}`,
					clone_url: `https://github.com/rani/repo-${index}.git`,
					default_branch: 'main',
					pushed_at: '2026-09-20T00:00:00Z',
					private: index === 2
				})),
				links: { first: null, last: null, prev: null, next: null },
				meta: {
					current_page: Number(url.searchParams.get('page') ?? 1),
					from: 1,
					last_page: 1,
					links: [],
					path: null,
					per_page: 30,
					to: 3,
					total: 3
				}
			}
		})
	});

	// Registered after the wizard mocks, so these win over its catch-all.
	await page.route('**/api/v1/auth/user', (route) =>
		json(route, {
			data: { ...signedInUser, name: long ? `Rani ${LONG}` : signedInUser.name, email }
		})
	);
	await page.route(`**/api/v1/app/projects/${PROJECT_ID}/deployments?*`, (route) =>
		route.request().method() === 'GET'
			? json(route, { data: deployments, meta: listMeta(deployments.length) })
			: route.fallback()
	);
	await page.route(`**/api/v1/app/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`, (route) =>
		json(route, { data: deployment })
	);
	await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) =>
		route.request().method() === 'GET'
			? json(route, {
					data: [
						project,
						{ ...project, id: 'p-2', runtime_status: 'failed', last_deployed_at: null },
						{ ...project, id: 'p-3', runtime_status: 'not_deployed', last_deployed_at: null }
					],
					links: { first: null, last: null, prev: null, next: null },
					meta: listMeta(3)
				})
			: route.fallback()
	);
	await page.route('**/api/v1/app/notifications/unread-count', (route) =>
		json(route, { data: { count: 1 } })
	);
	await page.route('**/api/v1/app/notifications?*', (route) =>
		json(route, {
			data: [
				{
					id: 'n-1',
					category: 'deployment_failure',
					title: long ? LONG : 'Deployment gagal',
					message: long ? LONG : 'Deployment toko-kopi-web gagal saat build.',
					project_id: PROJECT_ID,
					deployment_id: DEPLOYMENT_ID,
					read_at: null,
					created_at: '2026-10-01T00:00:00Z'
				}
			],
			meta: { current_page: 1, last_page: 1, total: 1 }
		})
	);
	await page.route('**/api/v1/app/notification-preferences', (route) =>
		json(route, {
			data: {
				deployment_success: true,
				deployment_failure: true,
				project_issue: true,
				account_security: true
			}
		})
	);
	await page.route('**/api/v1/app/profile', (route) =>
		json(route, {
			data: {
				...signedInUser,
				name: long ? `Rani ${LONG}` : signedInUser.name,
				email,
				role: 'student',
				bio: long ? LONG : null,
				github_username: long ? LONG : 'rani'
			}
		})
	);
}

/** Someone who has not logged in, for the auth screens. */
export async function mockSignedOutRoutes(page: Page) {
	await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
	await page.route('**/api/v1/auth/user', (route) =>
		json(route, { message: 'Unauthenticated.' }, 401)
	);
}

export const SIGNED_IN_ROUTES = [
	['projects', '/projects'],
	['project-new', '/projects/new'],
	['project-deployments', `/projects/${PROJECT_ID}/deployments`],
	['project-environments', `/projects/${PROJECT_ID}/environments`],
	['project-settings', `/projects/${PROJECT_ID}/settings`],
	['deployment-detail', `/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}`],
	['notifications', '/notifications'],
	['profile', '/profile'],
	['settings', '/settings'],
	['settings-notifications', '/settings?tab=notifications'],
	['feedback', '/feedback'],
	['not-found', '/halaman-yang-tidak-ada']
] as const;

export const SIGNED_OUT_ROUTES = [
	['login', '/login'],
	['register', '/register'],
	['forgot-password', '/forgot-password'],
	['reset-password', '/reset-password?token=t&email=rani%40sakala.local'],
	['email-verified', '/email-verified?status=success'],
	['email-changed', '/email-changed?status=success'],
	['github-callback-error', '/auth/github/callback?error=github_access_denied']
] as const;

export const WIDTHS = [320, 768, 1024, 1280, 1366] as const;
