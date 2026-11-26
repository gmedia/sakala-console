import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
	INVITATION_ID,
	mockEveryRoute,
	mockSignedOutRoutes,
	signedInUser,
	TEAM_ID
} from './fixtures/all-routes';
import { BUCKET_ID, mockBucketApi, spareBucket } from './fixtures/buckets';
import { DATABASE_ID, mockDatabaseApi, sampleDatabases } from './fixtures/databases';
import { auditDom } from './fixtures/dom-audit';
import { capturedDomain, domainStates, mockDomainsApi, type MockDomain } from './fixtures/domains';
import {
	DETAIL_URL,
	mockProjectApi,
	PROJECT_ID,
	sampleMetrics,
	succeededDeployment,
	type ApiHandlers
} from './fixtures/project-detail';
import {
	failedEvents,
	failedLogLines,
	logReply,
	realisticFailed,
	realisticSucceeded,
	succeededEvents,
	succeededLogLines
} from './fixtures/realistic-logs';
import { attachedDatabase, laravelInspection } from './fixtures/wizard-env-database';
import { cacheValkey, mockValkeyApi, QUEUE_ID, queueValkey } from './fixtures/valkeys';
import { mockWorkspaceApi, TEAM } from './fixtures/workspaces';
import {
	laravelProject,
	mockWorkloadApi,
	workloadLimits,
	workloadState
} from './fixtures/workloads';

const SETTINGS_URL = `/projects/${PROJECT_ID}/settings`;

/** Two captured domains side by side need their own ids and names. */
const withId = (domain: MockDomain, id: string, hostname: string): MockDomain => ({
	...domain,
	id,
	hostname
});

/**
 * Screenshots and word counts for the pull request, written only when SETTINGS_SHOTS names a
 * folder, so CI does not keep files nobody reads.
 */
const SHOTS_DIR = process.env.SETTINGS_SHOTS;
const WIDTHS = { wide: 1440, narrow: 320 } as const;

type FlagState = 'off' | 'on' | 'on-new';

/**
 * The project as each state shows it. `off`: the installation has none of the flagged sections.
 * `on`: Laravel with a live custom domain, workers, and schedules. `on-new`: the same flags on a
 * Laravel project that has none of them yet, which is when the panel suggests next steps.
 */
async function mockState(page: Page, state: FlagState) {
	const flagsOn = state !== 'off';
	const domains =
		state === 'on'
			? [domainStates.active(), withId(domainStates.pendingNew(), 'domain-2', 'api.kopi-senja.com')]
			: [];
	await mockDomainsApi(page, {
		enabled: flagsOn,
		max: 4,
		domains,
		project: flagsOn ? { ...laravelProject, max_replicas: 4, workspace: undefined } : {}
	});
	const workloads = workloadState();
	if (state === 'on-new') {
		workloads.processes = [];
		workloads.schedules = [];
	}
	await mockWorkloadApi(page, workloads, { workers: flagsOn, schedules: flagsOn });
	// Both mocks answer pilot-limits; this one, registered last, carries every flag at once.
	await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) => {
		const domainLimits = capturedDomain<{
			data: Record<string, unknown> & { quotas: Record<string, unknown> };
		}>(flagsOn ? 'pilot-limits-domains' : 'pilot-limits-domains-off').body.data;
		const workloadFlags = workloadLimits({ workers: flagsOn, schedules: flagsOn });
		return route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					...domainLimits,
					workers: workloadFlags.workers,
					schedules: workloadFlags.schedules,
					custom_domains: { enabled: flagsOn, target: 'edge.sakala.app' },
					quotas: {
						...domainLimits.quotas,
						...(workloadFlags as { quotas?: Record<string, unknown> }).quotas,
						max_custom_domains: 4,
						current_custom_domains_count: domains.length
					}
				}
			})
		});
	});
}

async function settled(page: Page) {
	await expect(page.getByTestId('settings-sections')).toBeVisible();
	await expect(
		page.getByTestId('form-page-main').or(page.getByTestId('settings-read-only')).first()
	)
		.toBeVisible()
		.catch(() => undefined);
	await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
}

/**
 * Words a person can see: text nodes that render, without screen-reader-only text, plus what
 * inputs show (their value, or the placeholder while empty). The same count runs on the old and
 * the new page, so the two numbers compare.
 */
function countVisibleWords(selectors: Record<string, string[]>) {
	const words = (text: string) => text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
	const visible = (element: Element) => {
		if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
		const rect = element.getBoundingClientRect();
		return rect.width > 1 || rect.height > 1;
	};
	const count = (root: Element) => {
		let total = 0;
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		while (walker.nextNode()) {
			const parent = walker.currentNode.parentElement;
			if (!parent || parent.closest('script, style, noscript, template') || !visible(parent))
				continue;
			total += words(walker.currentNode.textContent ?? '').length;
		}
		for (const input of root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
			'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea'
		)) {
			if (visible(input)) total += words(input.value || input.placeholder).length;
		}
		return total;
	};
	const result: Record<string, number | null> = {};
	for (const [name, candidates] of Object.entries(selectors)) {
		const root = candidates
			.map((selector) => document.querySelector(selector))
			.find((element) => element !== null);
		result[name] = root ? count(root) : null;
	}
	return result;
}

/**
 * Where to count, per page: the template's own column, or on the old pages the element that held
 * the same content. `content` is everything under the header (`#main-content`), `page` adds the
 * sidebar and header. The same selectors run on both, so the numbers compare.
 */
const REGIONS = {
	settings: {
		mainColumn: ['[data-testid="form-page-main"]', 'div:has(> [data-testid="settings-sections"])'],
		content: ['#main-content'],
		page: ['body']
	},
	valkey: {
		mainColumn: ['[data-testid="form-page-main"]', 'div:has(> [data-testid="valkey-overview"])'],
		content: ['#main-content'],
		page: ['body']
	},
	projects: {
		mainColumn: ['[data-testid="list-page"]', '#main-content > div'],
		content: ['#main-content'],
		page: ['body']
	},
	database: {
		mainColumn: ['[data-testid="form-page-main"]', 'div:has(> [data-testid="database-overview"])'],
		content: ['#main-content'],
		page: ['body']
	},
	bucket: {
		mainColumn: ['[data-testid="form-page-main"]', 'div:has(> [data-testid="bucket-overview"])'],
		content: ['#main-content'],
		page: ['body']
	},
	list: {
		mainColumn: ['[data-testid="list-page"]', '#main-content > div'],
		content: ['#main-content'],
		page: ['body']
	}
} satisfies Record<string, Record<string, string[]>>;

/** The Console scrolls inside `main`, which fullPage cannot see, so the window grows to fit it. */
async function capture(page: Page, name: string, regions: Record<string, string[]>) {
	if (!SHOTS_DIR) return;
	mkdirSync(SHOTS_DIR, { recursive: true });
	const width = page.viewportSize()?.width ?? WIDTHS.wide;
	// How far the page scrolls: the height of what `main` holds, header and tabs included.
	const scrollHeight = await page.evaluate(
		() => document.querySelector('main')?.scrollHeight ?? document.documentElement.scrollHeight
	);
	for (let pass = 0; pass < 2; pass++) {
		const height = await page.evaluate(() => {
			const main = document.querySelector('main');
			if (!main) return document.documentElement.scrollHeight;
			return main.scrollHeight + (window.innerHeight - main.clientHeight);
		});
		await page.setViewportSize({ width, height: Math.min(height, 12_000) });
	}
	await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
	writeFileSync(`${SHOTS_DIR}/${name}.html`, await page.content());
	const counts = await page.evaluate(countVisibleWords, regions);
	writeFileSync(
		`${SHOTS_DIR}/${name}.words.json`,
		JSON.stringify({ ...counts, scrollHeight }, null, '\t')
	);
}

/** The settings pages, by route segment, and what each must show once loaded. */
const SUB_PAGES = [
	['general', 'Nama proyek'],
	['build', 'Build command'],
	['domain', 'Nama domain'],
	['processes', null],
	['schedules', null],
	['danger', null]
] as const;

/**
 * Captures run on both sides of the change: the single settings page of origin/main, or each
 * sub-page with SETTINGS_SUBPAGES set (this branch).
 */
const SUBPAGES = Boolean(process.env.SETTINGS_SUBPAGES);

/** One screenshot at the window's own size, for the pull request; only with SETTINGS_SHOTS. */
async function screenshot1440(page: Page, name: string) {
	if (!SHOTS_DIR) return;
	mkdirSync(SHOTS_DIR, { recursive: true });
	await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
}

test.describe('settings screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	if (!SUBPAGES) {
		for (const state of ['off', 'on', 'on-new'] as const) {
			for (const [label, width] of Object.entries(WIDTHS)) {
				test(`${state} at ${width} px`, async ({ page }) => {
					await page.setViewportSize({ width, height: 900 });
					await mockState(page, state);
					await page.goto(SETTINGS_URL);
					await settled(page);
					await capture(page, `settings-${state}-${label}-${width}`, REGIONS.settings);
				});
			}
		}
	} else {
		for (const [segment] of SUB_PAGES) {
			for (const [label, width] of Object.entries(WIDTHS)) {
				test(`sub-page ${segment} at ${width} px`, async ({ page }) => {
					await page.setViewportSize({ width, height: 900 });
					await mockState(page, 'on');
					await page.goto(`${SETTINGS_URL}/${segment}`);
					await settled(page);
					await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
					await capture(page, `settings-${segment}-${label}-${width}`, REGIONS.settings);
				});
			}
		}
	}
});

test.describe('valkey and project list screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	const VALKEY_STATES = {
		queue: { id: QUEUE_ID, valkeys: () => [queueValkey(), cacheValkey()] },
		cache: { id: 'valkey-cache', valkeys: () => [queueValkey(), cacheValkey()] }
	} as const;

	for (const [state, { id, valkeys }] of Object.entries(VALKEY_STATES)) {
		for (const [label, width] of Object.entries(WIDTHS)) {
			test(`valkey ${state} at ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await mockValkeyApi(page, { valkeys: valkeys() });
				await page.goto(`/valkeys/${id}`);
				await expect(page.getByTestId('valkey-overview')).toBeVisible();
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				await capture(page, `valkey-${state}-${label}-${width}`, REGIONS.valkey);
			});
		}
	}

	for (const [label, width] of Object.entries(WIDTHS)) {
		test(`projects at ${width} px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await mockEveryRoute(page);
			await page.goto('/projects');
			await expect(page.getByRole('region', { name: 'Daftar proyek' })).toBeVisible();
			await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
			await capture(page, `projects-${label}-${width}`, REGIONS.projects);
		});
	}
});

/** A database no project uses yet: the state in which its panel suggests a next step. */
const unattachedDatabases = () =>
	sampleDatabases().map((database, index) =>
		index === 0 ? { ...database, projects: [] } : database
	);

/** Detail and list pages of databases and buckets, in the states that change what they show. */
const RESOURCE_PAGES = {
	'database-attached': {
		regions: REGIONS.database,
		open: async (page: Page) => {
			await mockDatabaseApi(page);
			await page.goto(`/databases/${DATABASE_ID}`);
			await expect(page.getByTestId('database-overview')).toBeVisible();
		}
	},
	'database-unattached': {
		regions: REGIONS.database,
		open: async (page: Page) => {
			await mockDatabaseApi(page, { databases: unattachedDatabases() });
			await page.goto(`/databases/${DATABASE_ID}`);
			await expect(page.getByTestId('database-overview')).toBeVisible();
		}
	},
	'bucket-attached': {
		regions: REGIONS.bucket,
		open: async (page: Page) => {
			await mockBucketApi(page);
			await page.goto(`/buckets/${BUCKET_ID}`);
			await expect(page.getByTestId('bucket-overview')).toBeVisible();
		}
	},
	'bucket-nearly-full': {
		regions: REGIONS.bucket,
		open: async (page: Page) => {
			await mockBucketApi(page);
			await page.goto(`/buckets/${spareBucket().id}`);
			await expect(page.getByTestId('bucket-overview')).toBeVisible();
		}
	},
	databases: {
		regions: REGIONS.list,
		open: async (page: Page) => {
			await mockDatabaseApi(page);
			await page.goto('/databases');
			await expect(page.getByTestId('database-row').first()).toBeVisible();
		}
	},
	buckets: {
		regions: REGIONS.list,
		open: async (page: Page) => {
			await mockBucketApi(page);
			await page.goto('/buckets');
			await expect(page.getByTestId('bucket-row').first()).toBeVisible();
		}
	}
} as const;

test.describe('database and bucket screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	for (const [name, { regions, open }] of Object.entries(RESOURCE_PAGES)) {
		for (const [label, width] of Object.entries(WIDTHS)) {
			test(`${name} at ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page);
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				await capture(page, `${name}-${label}-${width}`, regions);
			});
		}
	}
});

/** A deployment in the project's history, a few minutes apart, so the rows read like real ones. */
const historyRow = (sequence: number, overrides: Record<string, unknown> = {}) => {
	const created = new Date(Date.now() - (200 - sequence * 15) * 60_000).toISOString();
	return {
		...succeededDeployment,
		id: `01a0cd92-b2e0-7327-97a1-d688062f30${String(sequence).padStart(2, '0')}`,
		sequence,
		commit_sha: String(sequence).repeat(40).slice(0, 40),
		commit_message: `feat(web): perubahan nomor ${sequence}`,
		is_active: false,
		created_at: created,
		started_at: created,
		finished_at: new Date(Date.parse(created) + 52_000).toISOString(),
		...overrides
	};
};

const HISTORY = () => [
	historyRow(6, { is_active: true, commit_message: 'feat(web): halaman menu baru' }),
	historyRow(5, {
		status: 'failed',
		failure_summary: 'Proses build aplikasi berhenti sebelum selesai.',
		commit_message: 'fix(web): harga di keranjang'
	}),
	historyRow(4),
	historyRow(3),
	historyRow(2),
	historyRow(1, { commit_message: 'chore: deploy pertama' })
];

/** A monorepo push that changed only another project, right above the newest deployment. */
const SKIPPED_PUSH = {
	delivery_id: '6f1c2a3e-58cc-4372-a567-0e02b2c3d479',
	reason: 'no_changes_in_root_directory',
	commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
	commit_message: 'feat(api): endpoint pesanan',
	branch: 'main',
	root_directory: 'apps/web',
	changed_path_count: 3,
	example_paths: ['apps/api/routes/api.php', 'apps/api/app.php', 'apps/api/tests/OrderTest.php'],
	after_deployment_id: '01a0cd92-b2e0-7327-97a1-d688062f3006',
	created_at: new Date(Date.now() - 60_000).toISOString()
};

/** A Laravel project with a database attached and variables of its own, some of them secret. */
const variablesProject = () => ({
	...laravelProject,
	...laravelInspection(),
	release_command: 'php artisan migrate --force',
	databases: [attachedDatabase('ready', { status: 'started', deployment_id: null })]
});

const VARIABLES = [
	['APP_KEY', true, null],
	['APP_ENV', false, 'production'],
	['APP_URL', false, 'https://toko-kopi-web.sakala.app'],
	['MAIL_MAILER', false, 'log'],
	['MAILGUN_SECRET', true, null]
].map(([key, secret, value], index) => ({
	id: index + 1,
	key,
	is_secret: secret,
	value,
	created_at: '2026-11-19T10:00:00Z',
	updated_at: '2026-11-19T10:00:00Z'
}));

const projectRegions = (main: string) => ({
	mainColumn: ['[data-testid="list-page"]', main],
	content: ['#main-content'],
	page: ['body']
});
const TAB_CONTENT = 'div:has(> nav[aria-label="Bagian proyek"]) + div';

/** The project pages students open most, in the states that change what they show. */
const PROJECT_PAGES: Record<
	string,
	{ regions: Record<string, string[]>; open: (page: Page) => Promise<void> }
> = {
	history: {
		regions: projectRegions(TAB_CONTENT),
		open: async (page) => {
			await mockProjectApi(page, {
				deploymentList: HISTORY,
				skippedPushes: () => ({
					body: {
						data: [SKIPPED_PUSH],
						meta: { current_page: 1, from: 1, last_page: 1, per_page: 100, to: 1, total: 1 }
					}
				})
			});
			await page.goto(`/projects/${PROJECT_ID}/deployments`);
			await expect(page.getByText('feat(web): halaman menu baru')).toBeVisible();
		}
	},
	'deployment-failed': {
		regions: projectRegions('#main-content > div'),
		open: async (page) => {
			await mockProjectApi(page, {
				deployment: () => realisticFailed,
				deploymentList: () => [realisticFailed],
				events: () => failedEvents,
				logs: logReply(failedLogLines)
			});
			await page.goto(DETAIL_URL);
			await expect(page.getByRole('log').getByText('failed to solve')).toBeVisible();
		}
	},
	'deployment-succeeded': {
		regions: projectRegions('#main-content > div'),
		open: async (page) => {
			const second = { ...realisticSucceeded, sequence: 2 };
			await mockProjectApi(page, {
				deployment: () => second,
				deploymentList: () => [second, { ...realisticSucceeded, id: 'a', sequence: 1 }],
				events: () => succeededEvents,
				logs: logReply(succeededLogLines)
			});
			await page.goto(DETAIL_URL);
			await expect(page.getByRole('log').getByText('Server listening')).toBeVisible();
		}
	},
	variables: {
		regions: projectRegions(TAB_CONTENT),
		open: async (page) => {
			await mockProjectApi(page, {
				project: variablesProject,
				envList: () => VARIABLES
			} satisfies ApiHandlers);
			await page.goto(`/projects/${PROJECT_ID}/environments`);
			await expect(page.getByText('MAILGUN_SECRET', { exact: true })).toBeVisible();
		}
	},
	metrics: {
		regions: projectRegions(TAB_CONTENT),
		open: async (page) => {
			await mockProjectApi(page, {
				metrics: () => ({ body: sampleMetrics() }),
				deploymentList: () => [
					historyRow(6, { finished_at: new Date(Date.now() - 3 * 3_600_000).toISOString() }),
					historyRow(5, { finished_at: new Date(Date.now() - 9 * 3_600_000).toISOString() })
				]
			});
			await page.goto(`/projects/${PROJECT_ID}/monitoring`);
			await expect(page.locator('figure canvas')).toHaveCount(4);
		}
	},
	schedule: {
		regions: {
			mainColumn: ['[data-testid="form-page-main"]', 'div:has(> [data-testid="schedule-detail"])'],
			content: ['#main-content'],
			page: ['body']
		},
		open: async (page) => {
			const state = workloadState();
			await mockProjectApi(page, { project: () => laravelProject });
			await mockWorkloadApi(page, state);
			await page.goto(`${SETTINGS_URL}/schedules/${state.schedules[0].id as string}`);
			await expect(page.getByTestId('schedule-run').first()).toBeVisible();
		}
	}
};

test.describe('project page screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	for (const [name, { regions, open }] of Object.entries(PROJECT_PAGES)) {
		for (const [label, width] of Object.entries(WIDTHS)) {
			test(`${name} at ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page);
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				await capture(page, `${name}-${label}-${width}`, regions);
			});
		}
	}
});

/** Every way in and the legal versions, as an installation with email delivery on answers. */
async function mockAuthOptions(page: Page) {
	await page.route('**/api/v1/auth/options', (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify({
				data: {
					email_delivery_enabled: true,
					providers: { github: true, google: true },
					legal: {
						terms_version: 'syarat-v1',
						acceptable_use_version: 'penggunaan-wajar-v1',
						privacy_notice_version: 'privasi-v1'
					}
				}
			})
		})
	);
}

/** The team workspace's limits as sakala-api answers them (tests/fixtures/workspaces). */
const TEAM_LIMITS = (
	JSON.parse(
		readFileSync(new URL('../fixtures/workspaces/pilot-limits-team.json', import.meta.url), 'utf8')
	) as { body: unknown }
).body;

/** The signed-in account pages, with the same data as the every-route audit. */
async function signedIn(page: Page, overrides: Record<string, unknown> = {}) {
	await mockEveryRoute(page);
	await mockAuthOptions(page);
	// The account's own limits (deleting the account names the retention days).
	await page.route(/\/api\/v1\/app\/pilot-limits$/, (route) =>
		route.fulfill({
			contentType: 'application/json',
			body: JSON.stringify(TEAM_LIMITS)
		})
	);
	if (Object.keys(overrides).length > 0) {
		await page.route('**/api/v1/auth/user', (route) =>
			route.fulfill({
				contentType: 'application/json',
				body: JSON.stringify({ data: { ...signedInUser, ...overrides } })
			})
		);
	}
}

async function signedOut(page: Page) {
	await mockSignedOutRoutes(page);
	await mockAuthOptions(page);
}

/**
 * Where to count on the account, workspace, and auth pages: the template's column, or on the old
 * pages the element that held the same content.
 */
const accountRegions = (...main: string[]) => ({
	mainColumn: main,
	content: ['#main-content'],
	page: ['body']
});
const FORM_MAIN = '[data-testid="form-page-main"]';
const FOCUSED = '[data-testid="focused-page"]';
const APP_CONTENT = '#main-content > div';
const AUTH_COLUMN = 'main .max-w-md';
const STATUS_COLUMN = 'main#main-content';

/** The account pages, workspace, notifications, invitations, feedback, onboarding, and auth. */
const ACCOUNT_PAGES: Record<
	string,
	{ regions: Record<string, string[]>; open: (page: Page) => Promise<void> }
> = {
	'settings-profile': {
		regions: accountRegions(FORM_MAIN, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/settings');
			await expect(page.getByLabel('Nama lengkap')).toHaveValue(signedInUser.name);
		}
	},
	'settings-account': {
		regions: accountRegions(FORM_MAIN, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/settings?tab=account');
			await expect(page.getByLabel('Email baru')).toBeVisible();
		}
	},
	'settings-notifications': {
		regions: accountRegions(FORM_MAIN, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/settings?tab=notifications');
			await expect(page.getByRole('switch', { name: 'Semua notifikasi lonceng' })).toBeVisible();
		}
	},
	workspace: {
		regions: accountRegions(FORM_MAIN, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto(`/workspaces/${TEAM_ID}`);
			await expect(page.getByTestId('member-row').first()).toBeVisible();
			await expect(page.getByTestId('invitation-row').first()).toBeVisible();
		}
	},
	notifications: {
		regions: accountRegions('[data-testid="list-page"]', APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/notifications');
			await expect(page.getByText('Deployment toko-kopi-web gagal saat build.')).toBeVisible();
			await expect(page.getByTestId('my-invitations')).toBeVisible();
		}
	},
	invitations: {
		regions: accountRegions(FOCUSED, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/workspace-invitations');
			await expect(page.getByTestId('invitation-card')).toBeVisible();
		}
	},
	'invitation-link': {
		regions: accountRegions(FOCUSED, APP_CONTENT),
		open: async (page) => {
			await signedIn(page);
			await page.goto(`/workspace-invitations/${INVITATION_ID}?token=t`);
			await expect(page.getByTestId('invitation-card')).toBeVisible();
		}
	},
	feedback: {
		regions: accountRegions(FOCUSED, '#main-content > div', '#main-content'),
		open: async (page) => {
			await signedIn(page);
			await page.goto('/feedback');
			await expect(page.getByLabel('Masukanmu')).toBeVisible();
		}
	},
	onboarding: {
		regions: accountRegions(FOCUSED, 'main#main-content > div'),
		open: async (page) => {
			await signedIn(page, { onboarding_completed_at: null });
			await page.goto('/onboarding');
			await expect(page.getByRole('heading', { name: 'Selamat datang di Sakala' })).toBeVisible();
		}
	},
	login: {
		regions: accountRegions(AUTH_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/login');
			await expect(page.getByRole('button', { name: 'Masuk dengan GitHub' })).toBeVisible();
		}
	},
	register: {
		regions: accountRegions(AUTH_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/register');
			await expect(page.getByLabel('Nama lengkap')).toBeVisible();
		}
	},
	'forgot-password': {
		regions: accountRegions(AUTH_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/forgot-password');
			await expect(page.getByLabel('Email')).toBeVisible();
		}
	},
	'reset-password': {
		regions: accountRegions(AUTH_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/reset-password?token=t&email=rani%40sakala.local');
			await expect(page.getByLabel('Kata sandi baru', { exact: true })).toBeVisible();
		}
	},
	'email-verified': {
		regions: accountRegions(STATUS_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/email-verified?status=success');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		}
	},
	'email-verified-error': {
		regions: accountRegions(STATUS_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/email-verified?status=error');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		}
	},
	'email-changed': {
		regions: accountRegions(STATUS_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto('/email-changed?status=success');
			await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		}
	},
	unsubscribe: {
		regions: accountRegions(STATUS_COLUMN),
		open: async (page) => {
			await signedOut(page);
			await page.goto(
				'/notifications/unsubscribe?category=deployment_failure&user=1&expires=1&signature=s'
			);
			await expect(page.getByRole('button', { name: 'Ya, matikan email ini' })).toBeVisible();
		}
	}
};

test.describe('account, workspace, and auth screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	for (const [name, { regions, open }] of Object.entries(ACCOUNT_PAGES)) {
		for (const [label, width] of Object.entries(WIDTHS)) {
			test(`${name} at ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page);
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				await capture(page, `${name}-${label}-${width}`, regions);
			});
		}
	}
});

test.describe('the page templates', () => {
	/** Every page and state the templates were applied to, opened the way a person would. */
	const PAGES: [string, (page: Page) => Promise<void>][] = [
		...SUB_PAGES.map(
			([segment, visible]) =>
				[
					`settings ${segment}`,
					async (page: Page) => {
						await mockState(page, 'on');
						await page.goto(`${SETTINGS_URL}/${segment}`);
						await settled(page);
						if (visible) await expect(page.getByLabel(visible)).toBeVisible();
					}
				] as [string, (page: Page) => Promise<void>]
		),
		...(
			[
				['queue', QUEUE_ID],
				['cache', 'valkey-cache']
			] as const
		).map(
			([state, id]) =>
				[
					`valkey ${state}`,
					async (page: Page) => {
						await mockValkeyApi(page, { valkeys: [queueValkey(), cacheValkey()] });
						await page.goto(`/valkeys/${id}`);
						await expect(page.getByTestId('valkey-facts')).toBeVisible();
					}
				] as [string, (page: Page) => Promise<void>]
		),
		[
			'projects',
			async (page: Page) => {
				await mockEveryRoute(page);
				await page.goto('/projects');
				await expect(page.getByTestId('list-page')).toBeVisible();
			}
		],
		...Object.entries(RESOURCE_PAGES).map(
			([name, { open }]) => [name, open] as [string, (page: Page) => Promise<void>]
		),
		...Object.entries(PROJECT_PAGES).map(
			([name, { open }]) => [name, open] as [string, (page: Page) => Promise<void>]
		),
		...Object.entries(ACCOUNT_PAGES).map(
			([name, { open }]) => [name, open] as [string, (page: Page) => Promise<void>]
		)
	];

	/**
	 * Findings on the deployment page that predate the templates and sit in parts this rollout does
	 * not touch: the log's search field on the dark terminal, its line-number permalinks (20 px rows),
	 * and the live address in the success banner (one line of text). Anything else still fails.
	 */
	const KNOWN_LOG_PAGE_FINDINGS = [
		/^[\d.]+ input "log-search"$/,
		/^\d+x20 a "\d+"$/,
		/^\d+x20 a "toko-kopi-web\.sakala\.app"$/
	];
	const withoutKnown = (name: string, findings: string[]) =>
		name.startsWith('deployment-')
			? findings.filter((finding) => !KNOWN_LOG_PAGE_FINDINGS.some((known) => known.test(finding)))
			: findings;

	for (const [name, open] of PAGES) {
		for (const width of Object.values(WIDTHS)) {
			test(`${name} at ${width} px keeps the accessibility floor`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page);
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				expect.soft(audit.overflow, 'nothing past the viewport').toEqual([]);
				expect.soft(audit.contrast, 'text and placeholder contrast').toEqual([]);
				expect.soft(withoutKnown(name, audit.controls), 'edge of inputs and switches').toEqual([]);
				expect.soft(withoutKnown(name, audit.targets), 'targets of at least 24 px').toEqual([]);
				expect.soft(audit.primaryTargets, 'primary actions on touch layouts').toEqual([]);
				expect.soft(audit.h1).toBe(1);
			});
		}
	}

	test('two columns only with the sidebar shown and 56rem of content', async ({ page }) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(`${SETTINGS_URL}/general`);
		await settled(page);
		const columns = async () => {
			const [form, panel] = [
				(await page.getByTestId('form-page-main').boundingBox())!,
				(await page.getByTestId('form-page-panel').boundingBox())!
			];
			return panel.x > form.x + form.width;
		};
		// The sidebar takes about 360 px from 1024 px, so 56rem of content starts near 1256 px;
		// below 1024 px the sidebar is a drawer, and the panel stacks there too.
		for (const [width, twoColumns] of [
			[960, false],
			[1023, false],
			[1200, false],
			[1280, true],
			[1440, true]
		] as const) {
			await page.setViewportSize({ width, height: 900 });
			expect(await columns(), `${width} px`).toBe(twoColumns);
		}
	});

	test('the panel holds next steps and guides only; project facts stay in the header', async ({
		page
	}) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(`${SETTINGS_URL}/build`);
		await settled(page);
		const panel = page.getByRole('complementary', { name: 'Langkah dan bantuan' });
		await expect(panel.getByRole('heading', { level: 2 })).toHaveText(['Berikutnya', 'Bantuan']);
		await expect(page.getByText('Ringkasan', { exact: true })).toHaveCount(1); // the overview tab
		await expect(page.getByTestId('project-public-url')).toBeVisible();
	});

	test('the sub-navigation wraps at 320 px and marks the current page', async ({ page }) => {
		await mockState(page, 'on');
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		await page.goto(`${SETTINGS_URL}/schedules`);
		await settled(page);
		const nav = page.getByRole('navigation', { name: 'Bagian pengaturan' });
		await expect(nav.getByRole('link')).toHaveText([
			'Umum',
			'Build dan start',
			'Domain',
			'Proses',
			'Jadwal',
			'Zona berbahaya'
		]);
		await expect(nav.getByRole('link', { name: 'Jadwal' })).toHaveAttribute('aria-current', 'page');
		for (const link of await nav.getByRole('link').all()) {
			const box = (await link.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(WIDTHS.narrow);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
	});

	test('links from before the split land on the right page', async ({ page }) => {
		await mockState(page, 'on');
		for (const [anchor, path, visible] of [
			['jadwal', '/schedules', page.getByTestId('schedules-section')],
			['proses', '/processes', page.getByTestId('processes-section')],
			['domain', '/domain', page.getByTestId('domains-section')],
			['zona-berbahaya', '/danger', page.getByRole('button', { name: 'Hapus proyek' })],
			['replicas', '/build#replicas', page.getByRole('spinbutton', { name: 'Replika' })]
		] as const) {
			await page.goto(`${SETTINGS_URL}#${anchor}`);
			await expect(page).toHaveURL(`${SETTINGS_URL}${path}`);
			await expect(visible).toBeVisible();
		}
	});

	test('a next step lands on its page, opening Lanjutan for the release command', async ({
		page
	}) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(`${SETTINGS_URL}/general`);
		await settled(page);
		const steps = page.getByTestId('settings-next-steps').getByRole('link');
		await expect(steps).toHaveText([
			'Atur release command',
			'Pasang custom domain',
			'Tambah worker antrean'
		]);
		await steps.first().click();
		await expect(page).toHaveURL(`${SETTINGS_URL}/build#releaseCommand`);
		await expect(page.getByRole('textbox', { name: 'Release command' })).toBeInViewport();
		await page
			.getByTestId('settings-next-steps')
			.getByRole('link', { name: 'Tambah worker antrean' })
			.click();
		await expect(page).toHaveURL(`${SETTINGS_URL}/processes`);
		await expect(page.getByTestId('processes-section')).toBeVisible();
	});

	test('a hidden step stays hidden after a reload, for this person and project, until restored', async ({
		page
	}) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(`${SETTINGS_URL}/general`);
		await settled(page);
		const steps = page.getByTestId('settings-next-steps');
		await expect(steps.getByRole('link', { name: 'Atur release command' })).toBeVisible();

		await steps.getByRole('button', { name: 'Sembunyikan langkah Atur release command' }).click();
		await expect(steps.getByRole('link', { name: 'Atur release command' })).toHaveCount(0);
		// Focus stays in the list, on the step that took its place.
		await expect(
			steps.getByRole('button', { name: 'Sembunyikan langkah Pasang custom domain' })
		).toBeFocused();
		// The next step that applies takes the free place.
		await expect(steps.getByRole('link')).toHaveText([
			'Pasang custom domain',
			'Tambah worker antrean',
			'Buat jadwal Laravel'
		]);
		await screenshot1440(page, 'settings-dismiss-1440');

		await page.reload();
		await settled(page);
		await expect(steps.getByRole('link', { name: 'Pasang custom domain' })).toBeVisible();
		await expect(steps.getByRole('link', { name: 'Atur release command' })).toHaveCount(0);
		// Kept under the signed-in user's id and the project's id.
		expect(
			await page.evaluate(
				(key) => window.localStorage.getItem(key),
				`sakala.overview-dismissed-steps.1.${PROJECT_ID}`
			)
		).toBe('["release-command"]');

		await page.getByRole('button', { name: 'Tampilkan langkah yang disembunyikan' }).click();
		await expect(steps.getByRole('link', { name: 'Atur release command' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Berikutnya' })).toBeFocused();
		await expect(
			page.getByRole('button', { name: 'Tampilkan langkah yang disembunyikan' })
		).toHaveCount(0);
	});

	test('with every step hidden, only Bantuan stays, holding the way back', async ({ page }) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(`${SETTINGS_URL}/general`);
		await settled(page);
		const steps = page.getByTestId('settings-next-steps');
		const restore = page.getByRole('button', { name: 'Tampilkan langkah yang disembunyikan' });
		// Five steps apply to a new Laravel project; each hidden one lets the next take its place.
		for (let hidden = 0; hidden < 5; hidden++) {
			await steps
				.getByRole('button', { name: /^Sembunyikan langkah / })
				.first()
				.click();
		}
		await expect(steps).toHaveCount(0);
		await expect(page.getByTestId('settings-help').getByRole('button')).toHaveText(
			'Tampilkan langkah yang disembunyikan'
		);
		await expect(restore).toBeFocused();

		// A page without guides then has no panel at all.
		await page.goto(`${SETTINGS_URL}/domain`);
		await expect(page.getByTestId('domains-section')).toBeVisible();
		await expect(page.getByRole('complementary', { name: 'Langkah dan bantuan' })).toHaveCount(0);
	});

	test('with the flags off nothing asks for domains, workers, or schedules', async ({ page }) => {
		const calls: string[] = [];
		page.on('request', (request) => {
			const { pathname } = new URL(request.url());
			// API calls only: the settings pages themselves live under /settings/schedules and so on.
			if (pathname.startsWith('/api/') && /\/(domains|processes|schedules)$/.test(pathname)) {
				calls.push(request.url());
			}
		});
		await mockState(page, 'off');
		await page.goto(`${SETTINGS_URL}/general`);
		await settled(page);
		await expect(page.getByTestId('settings-next-steps')).toHaveCount(0);
		// A page typed by hand says the feature is off, without asking for it.
		await page.goto(`${SETTINGS_URL}/domain`);
		await expect(page.getByTestId('domains-unavailable')).toBeVisible();
		await page.goto(`${SETTINGS_URL}/schedules`);
		await expect(page.getByTestId('schedules-unavailable')).toBeVisible();
		expect(calls).toEqual([]);
	});

	test('the Valkey page follows the same template: facts under the name, deleting last', async ({
		page
	}) => {
		await mockValkeyApi(page, { valkeys: [queueValkey(), cacheValkey()] });
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		await page.goto('/valkeys/valkey-cache');
		await expect(page.getByTestId('valkey-facts')).toContainText('Cache');
		await expect(page.getByTestId('valkey-facts')).toContainText('32 MB');
		const panel = (await page.getByTestId('form-page-panel').boundingBox())!;
		const danger = (await page.getByTestId('valkey-danger-zone').boundingBox())!;
		expect(danger.y).toBeGreaterThan(panel.y + panel.height);
		await expect(
			page
				.getByRole('complementary', { name: 'Langkah dan bantuan Valkey' })
				.getByRole('heading', { level: 2 })
		).toHaveText(['Berikutnya', 'Bantuan']);
		// The how-to stays folded until asked for.
		await expect(page.getByText('REDIS_CLIENT=predis')).toBeHidden();
		await page.getByTestId('valkey-usage-laravel').locator('summary').click();
		await expect(page.getByText('REDIS_CLIENT=predis')).toBeVisible();
	});
	test('the database and bucket pages follow the same template: facts under the name, deleting last', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		for (const [kind, open, label, facts] of [
			['database', RESOURCE_PAGES['database-unattached'].open, 'database', 'PostgreSQL'],
			['bucket', RESOURCE_PAGES['bucket-nearly-full'].open, 'bucket', 'kuota 100 MB']
		] as const) {
			await open(page);
			await expect(page.getByTestId(`${kind}-facts`)).toContainText(facts);
			await expect(page.getByTestId(`${kind}-facts-projects`)).toHaveText('0 proyek');
			const panel = (await page.getByTestId('form-page-panel').boundingBox())!;
			const danger = (await page.getByTestId(`${kind}-danger-zone`).boundingBox())!;
			expect(danger.y, `${kind} delete after the panel`).toBeGreaterThan(panel.y + panel.height);
			const aside = page.getByRole('complementary', { name: `Langkah dan bantuan ${label}` });
			await expect(aside.getByRole('heading', { level: 2 })).toHaveText(['Berikutnya', 'Bantuan']);
			// Steps go away by themselves once done, so they have no button to hide them.
			await expect(page.getByTestId(`${kind}-next-steps`).getByRole('button')).toHaveCount(0);
			await expect(page.getByText('Ringkasan', { exact: true })).toHaveCount(0);
		}
	});

	test('a next step lands on its card', async ({ page }) => {
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await RESOURCE_PAGES['bucket-nearly-full'].open(page);
		const steps = page.getByTestId('bucket-next-steps').getByRole('link');
		await expect(steps).toHaveText(['Pasang ke proyek', 'Naikkan kuota']);
		await steps.nth(1).click();
		// The step opens the quota editor beside the quota, with its field focused.
		const quota = page.getByLabel('Kuota (MB)');
		await expect(quota).toBeFocused();
		await expect(quota).toBeInViewport();
		// The same step opens the editor again, although the address already has its anchor.
		await page.keyboard.press('Escape');
		await expect(quota).toHaveCount(0);
		await steps.nth(1).click();
		await expect(quota).toBeFocused();

		await RESOURCE_PAGES['database-unattached'].open(page);
		await page.getByTestId('database-next-steps').getByRole('link').click();
		await expect(page).toHaveURL(/#database-projects$/);
		await expect(page.getByTestId('attach-project')).toBeInViewport();
	});

	test('the database and bucket lists show the quota as a badge and a meter beside the action', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await RESOURCE_PAGES.databases.open(page);
		const toolbar = page.getByTestId('list-page-toolbar');
		await expect(toolbar.getByTestId('database-quota-count')).toHaveText('2 dari 3 database');
		await expect(toolbar.getByRole('meter')).toBeVisible();
		await expect(toolbar.getByTestId('create-database')).toBeVisible();

		await RESOURCE_PAGES.buckets.open(page);
		await expect(toolbar.getByTestId('bucket-quota-count')).toBeVisible();
		await expect(toolbar.getByRole('meter')).toBeVisible();
		await expect(toolbar.getByTestId('create-bucket')).toBeVisible();
	});
	test('rename, size, and quota open in place, by keyboard, and stay above the floor', async ({
		page
	}) => {
		for (const width of Object.values(WIDTHS)) {
			await page.setViewportSize({ width, height: 900 });
			for (const [open, button, field] of [
				[RESOURCE_PAGES['database-attached'].open, 'Ubah nama database', 'Nama database'],
				[RESOURCE_PAGES['bucket-attached'].open, 'Ubah kuota bucket', 'Kuota (MB)'],
				[RESOURCE_PAGES['bucket-attached'].open, 'Ubah nama bucket', 'Nama bucket'],
				[
					async (p: Page) => {
						await mockValkeyApi(p, { valkeys: [queueValkey(), cacheValkey()] });
						await p.goto(`/valkeys/${QUEUE_ID}`);
						await expect(p.getByTestId('valkey-facts')).toBeVisible();
					},
					'Ubah ukuran Valkey',
					null
				],
				[
					async (p: Page) => {
						await mockValkeyApi(p, { valkeys: [queueValkey(), cacheValkey()] });
						await p.goto(`/valkeys/${QUEUE_ID}`);
						await expect(p.getByTestId('valkey-facts')).toBeVisible();
					},
					'Ubah nama Valkey',
					'Nama Valkey'
				]
			] as const) {
				await open(page);
				const trigger = page.getByRole('button', { name: button });
				await trigger.focus();
				await page.keyboard.press('Enter');
				await expect(trigger).toHaveAttribute('aria-expanded', 'true');
				const focused = field
					? page.getByLabel(field, { exact: true })
					: page.getByRole('radio', { checked: true });
				await expect(focused, `${button} at ${width} px`).toBeFocused();
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				expect.soft(audit.overflow, `${button} at ${width} px: overflow`).toEqual([]);
				expect.soft(audit.contrast, `${button} at ${width} px: contrast`).toEqual([]);
				expect.soft(audit.targets, `${button} at ${width} px: targets`).toEqual([]);
				await page.keyboard.press('Escape');
				await expect(trigger).toBeFocused();
				await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			}
		}
	});

	test('the project pages use the list template; the schedule page the form template', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		for (const name of ['history', 'deployment-failed', 'variables', 'metrics'] as const) {
			await PROJECT_PAGES[name].open(page);
			await expect(page.getByTestId('list-page'), name).toBeVisible();
			await expect(page.getByTestId('form-page-panel'), name).toHaveCount(0);
		}
		// The variables Sakala fills in say one line and hide their values like a secret.
		const database = page.getByTestId('database-variables');
		await PROJECT_PAGES.variables.open(page);
		await expect(
			database.getByRole('img', { name: 'Nilai dari database contoh-laravel, disembunyikan' })
		).toHaveCount(3);
		await expect(database.getByText('Ditimpa proyek')).toHaveCount(0);

		await PROJECT_PAGES.schedule.open(page);
		await expect(page.getByTestId('form-page-panel')).toBeVisible();
		await expect(page.getByTestId('schedule-facts')).toContainText(/Berikutnya .* WIB/);
		await expect(page.getByTestId('schedule-facts')).toContainText('batas 300 detik');
		// The newest run failed, so the panel leads to it.
		const step = page.getByTestId('schedule-next-steps').getByRole('link', {
			name: 'Lihat run gagal'
		});
		await step.click();
		await expect(page.locator('[data-testid="schedule-run"]:target')).toBeInViewport();
		// Deleting is last: after the panel.
		const after = page.getByTestId('form-page-after');
		await expect(after.getByTestId('schedule-danger-zone')).toBeVisible();
	});

	test('the schedule name and time limit open in place, by keyboard, and send only that field', async ({
		page
	}) => {
		const state = workloadState();
		const scheduleId = state.schedules[0].id as string;
		for (const width of Object.values(WIDTHS)) {
			await page.setViewportSize({ width, height: 900 });
			await mockProjectApi(page, { project: () => laravelProject });
			await mockWorkloadApi(page, state);
			await page.goto(`${SETTINGS_URL}/schedules/${scheduleId}`);
			await expect(page.getByTestId('schedule-run').first()).toBeVisible();

			for (const [button, field] of [
				['Ubah nama jadwal', 'Nama'],
				['Ubah batas waktu run', 'Batas waktu run (detik)']
			] as const) {
				const trigger = page.getByRole('button', { name: button });
				await trigger.focus();
				await page.keyboard.press('Enter');
				await expect(trigger).toHaveAttribute('aria-expanded', 'true');
				await expect(page.getByLabel(field, { exact: true })).toBeFocused();
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				expect.soft(audit.overflow, `${button} at ${width} px: overflow`).toEqual([]);
				expect.soft(audit.contrast, `${button} at ${width} px: contrast`).toEqual([]);
				expect.soft(audit.targets, `${button} at ${width} px: targets`).toEqual([]);
				await page.keyboard.press('Escape');
				await expect(trigger).toBeFocused();
				await expect(trigger).toHaveAttribute('aria-expanded', 'false');
			}
		}

		// Above the installation's limit the field says so, and nothing is sent.
		const trigger = page.getByRole('button', { name: 'Ubah batas waktu run' });
		await trigger.click();
		const field = page.getByLabel('Batas waktu run (detik)', { exact: true });
		await field.fill('900');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('schedule-timeout-editor')).toContainText(
			'Batas waktu run antara 1 dan 600 detik.'
		);
		expect(state.requests.filter((request) => request.method === 'PATCH')).toEqual([]);

		await field.fill('120');
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('schedule-timeout-value')).toHaveText('batas 120 detik');
		await expect(trigger).toBeFocused();
		expect(state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body).toEqual({
			timeout_seconds: 120
		});

		await page.getByRole('button', { name: 'Ubah nama jadwal' }).click();
		await page.getByLabel('Nama', { exact: true }).fill('Laporan pagi');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Laporan pagi' })).toBeVisible();
		expect(state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body).toEqual({
			name: 'Laporan pagi'
		});

		// Deleting asks first, in the same dialog as before, then goes back to the schedules.
		await page.getByTestId('delete-schedule').click();
		const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
		await expect(dialog).toContainText('Hapus jadwal Laporan pagi?');
		await dialog.getByRole('button', { name: 'Hapus jadwal' }).click();
		await expect(page).toHaveURL(`${SETTINGS_URL}/schedules`);
		expect(state.requests.some((request) => request.method === 'DELETE')).toBe(true);
	});

	test('account settings use the form template: guides in the panel, deleting last on its tab', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		await ACCOUNT_PAGES['settings-account'].open(page);
		const panel = page.getByRole('complementary', { name: 'Bantuan akun' });
		await expect(panel.getByRole('heading', { level: 2 })).toHaveText(['Bantuan']);
		await expect(panel.getByRole('link')).toHaveText([
			/Pemberitahuan Privasi/,
			/Syarat Layanan/,
			/Kebijakan Penggunaan Wajar/
		]);
		// Deleting the account is last, under the panel on a phone.
		const panelBox = (await page.getByTestId('form-page-panel').boundingBox())!;
		const danger = (await page.getByTestId('delete-account-zone').boundingBox())!;
		expect(danger.y).toBeGreaterThan(panelBox.y + panelBox.height);
		// What the data file holds stays folded until asked for.
		await expect(page.getByText(/Log deployment dan jejak audit tidak termasuk/)).toBeHidden();
		await page.getByTestId('account-data-contents').locator('summary').click();
		await expect(page.getByText(/Log deployment dan jejak audit tidak termasuk/)).toBeVisible();

		// The sections wrap at 320 px, every link inside the window and 44 px tall.
		const nav = page.getByRole('navigation', { name: 'Bagian pengaturan akun' });
		for (const link of await nav.getByRole('link').all()) {
			const box = (await link.boundingBox())!;
			expect(box.x + box.width).toBeLessThanOrEqual(WIDTHS.narrow);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}

		// The other tabs have no danger zone, and the same guides.
		for (const name of ['settings-profile', 'settings-notifications'] as const) {
			await ACCOUNT_PAGES[name].open(page);
			await expect(page.getByTestId('form-page-after'), name).toHaveCount(0);
			await expect(page.getByTestId('account-help'), name).toBeVisible();
		}
		// One card, three named groups of switches (the folded explanation is a group of its own).
		await expect(
			page.getByTestId('notification-categories').locator('div[role="group"]')
		).toHaveText([/^Aktivitas proyek/, /^Tim/, /^Keamanan akun/]);
	});

	test('the profile shows the email and join date in one line under the photo', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await ACCOUNT_PAGES['settings-profile'].open(page);
		await expect(page.getByTestId('profile-facts')).toHaveText(
			/rani@sakala\.local\s*·\s*bergabung 1 Januari 2026/
		);
		await page.getByRole('link', { name: 'Ganti email' }).click();
		await expect(page).toHaveURL('/settings?tab=account');
		await expect(page.getByLabel('Email baru')).toBeVisible();
	});

	test('the workspace page: role, profile, and usage under the name, leaving and deleting last', async ({
		page
	}) => {
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		await ACCOUNT_PAGES.workspace.open(page);
		await expect(page.getByTestId('workspace-facts')).toHaveText(
			/Peranmu:\s*Pemilik\s*Workspace tim\s*·\s*profil Magang GMEDIA/
		);
		await expect(page.getByTestId('workspace-quotas').getByRole('listitem')).toHaveText([
			'1 dari 5 proyek',
			'0 dari 2 deployment berjalan',
			'0 dari 3 aplikasi aktif'
		]);
		const aside = page.getByRole('complementary', { name: 'Bantuan workspace' });
		await expect(aside.getByRole('heading', { level: 2 })).toHaveText(['Bantuan']);
		await expect(aside.getByRole('link', { name: /Batas pilot/ })).toHaveAttribute(
			'href',
			/batas-pilot#batas-per-workspace$/
		);
		const panel = (await page.getByTestId('form-page-panel').boundingBox())!;
		const danger = (await page.getByTestId('workspace-danger-zone').boundingBox())!;
		expect(danger.y).toBeGreaterThan(panel.y + panel.height);
		// A button that cannot be used yet says why, right under it.
		await expect(page.getByRole('button', { name: 'Hapus workspace' })).toHaveAccessibleDescription(
			/masih punya 1 proyek/
		);
	});

	test('the workspace name opens in place, by keyboard, and sends only the name', async ({
		page
	}) => {
		const patches: unknown[] = [];
		page.on('request', (request) => {
			if (request.method() === 'PATCH' && /\/workspaces\/[^/]+$/.test(request.url())) {
				patches.push(request.postDataJSON());
			}
		});
		for (const width of Object.values(WIDTHS)) {
			await page.setViewportSize({ width, height: 900 });
			await mockWorkspaceApi(page, { persona: 'owner' });
			await page.goto(`/workspaces/${TEAM.id}`);
			const trigger = page.getByRole('button', { name: 'Ubah nama workspace' });
			await trigger.focus();
			await page.keyboard.press('Enter');
			await expect(trigger).toHaveAttribute('aria-expanded', 'true');
			const field = page.getByLabel('Nama workspace', { exact: true });
			await expect(field).toBeFocused();
			const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
			expect.soft(audit.overflow, `rename at ${width} px: overflow`).toEqual([]);
			expect.soft(audit.contrast, `rename at ${width} px: contrast`).toEqual([]);
			expect.soft(audit.targets, `rename at ${width} px: targets`).toEqual([]);
			await page.keyboard.press('Escape');
			await expect(trigger).toBeFocused();
		}
		await page.getByRole('button', { name: 'Ubah nama workspace' }).click();
		await page.getByLabel('Nama workspace', { exact: true }).fill('Tim Kelas Web');
		await page.keyboard.press('Enter');
		await expect(page.getByRole('heading', { name: 'Tim Kelas Web' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Ubah nama workspace' })).toBeFocused();
		expect(patches).toEqual([{ name: 'Tim Kelas Web' }]);
	});

	test('one-decision pages are centred; notifications keep to reading width', async ({ page }) => {
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		for (const name of ['invitations', 'invitation-link', 'feedback', 'onboarding'] as const) {
			await ACCOUNT_PAGES[name].open(page);
			const column = (await page.getByTestId('focused-page').boundingBox())!;
			const main = (await page.locator('#main-content').boundingBox())!;
			const left = column.x - main.x;
			const right = main.x + main.width - (column.x + column.width);
			// Centred in the content area, which is the whole window on onboarding.
			expect(Math.abs(left - right), name).toBeLessThan(2);
		}
		await ACCOUNT_PAGES.notifications.open(page);
		await expect(page.getByTestId('list-page-toolbar').getByRole('button')).toHaveText([
			'Semua',
			'Belum dibaca',
			'Tandai semua telah dibaca'
		]);
		const list = (await page.getByTestId('list-page').boundingBox())!;
		expect(list.width).toBeLessThanOrEqual(48 * 16);
	});
});
