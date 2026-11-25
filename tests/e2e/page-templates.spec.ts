import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { mockEveryRoute } from './fixtures/all-routes';
import { auditDom } from './fixtures/dom-audit';
import { capturedDomain, domainStates, mockDomainsApi, type MockDomain } from './fixtures/domains';
import { PROJECT_ID } from './fixtures/project-detail';
import { cacheValkey, mockValkeyApi, QUEUE_ID, queueValkey } from './fixtures/valkeys';
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
	}
} satisfies Record<string, Record<string, string[]>>;

/** The Console scrolls inside `main`, which fullPage cannot see, so the window grows to fit it. */
async function capture(page: Page, name: string, regions: Record<string, string[]>) {
	if (!SHOTS_DIR) return;
	mkdirSync(SHOTS_DIR, { recursive: true });
	const width = page.viewportSize()?.width ?? WIDTHS.wide;
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
	writeFileSync(`${SHOTS_DIR}/${name}.words.json`, JSON.stringify(counts, null, '\t'));
}

test.describe('settings screenshots and word counts', () => {
	test.skip(!SHOTS_DIR, 'Only when SETTINGS_SHOTS names a folder.');

	for (const state of ['off', 'on', 'on-new'] as const) {
		for (const [label, width] of Object.entries(WIDTHS)) {
			test(`${state} at ${width} px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await mockState(page, state);
				await page.goto(SETTINGS_URL);
				await settled(page);
				if (state !== 'off') {
					await expect(page.getByTestId('processes-section')).toBeVisible();
					await expect(page.getByTestId('schedules-section')).toBeVisible();
					await expect(page.getByTestId('domains-section')).toBeVisible();
				}
				await capture(page, `settings-${state}-${label}-${width}`, REGIONS.settings);
			});
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

test.describe('the settings layout', () => {
	/** Every page and state the templates were applied to, opened the way a person would. */
	const PAGES: [string, (page: Page) => Promise<void>][] = [
		...(['off', 'on', 'on-new'] as const).map(
			(state) =>
				[
					`settings ${state}`,
					async (page: Page) => {
						await mockState(page, state);
						await page.goto(SETTINGS_URL);
						await settled(page);
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
						await expect(page.getByTestId('valkey-summary')).toBeVisible();
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
		]
	];

	for (const [name, open] of PAGES) {
		for (const width of Object.values(WIDTHS)) {
			test(`${name} at ${width} px keeps the accessibility floor`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await open(page);
				await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
				const audit = await auditDom(page, 24, width < 768 ? 44 : 24);
				expect.soft(audit.overflow, 'nothing past the viewport').toEqual([]);
				expect.soft(audit.contrast, 'text and placeholder contrast').toEqual([]);
				expect.soft(audit.controls, 'edge of inputs and switches').toEqual([]);
				expect.soft(audit.targets, 'targets of at least 24 px').toEqual([]);
				expect.soft(audit.primaryTargets, 'primary actions on touch layouts').toEqual([]);
				expect.soft(audit.h1).toBe(1);
			});
		}
	}

	test('two columns only with the sidebar shown and 56rem of content', async ({ page }) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto(SETTINGS_URL);
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

	test('the Valkey page follows the same template, with deleting last', async ({ page }) => {
		await mockValkeyApi(page, { valkeys: [queueValkey(), cacheValkey()] });
		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		await page.goto('/valkeys/valkey-cache');
		const panel = (await page.getByTestId('form-page-panel').boundingBox())!;
		const danger = (await page.getByTestId('valkey-danger-zone').boundingBox())!;
		expect(danger.y).toBeGreaterThan(panel.y + panel.height);
		await expect(
			page.getByRole('complementary', { name: 'Ringkasan Valkey' }).getByTestId('valkey-summary')
		).toBeVisible();
		// The how-to stays folded until asked for.
		await expect(page.getByText('REDIS_CLIENT=predis')).toBeHidden();
		await page.getByTestId('valkey-usage-laravel').locator('summary').click();
		await expect(page.getByText('REDIS_CLIENT=predis')).toBeVisible();
	});

	test('wide: the panel sits right of the form; narrow: under it, before the danger zone', async ({
		page
	}) => {
		await mockState(page, 'on-new');
		const box = async (testId: string) => (await page.getByTestId(testId).boundingBox())!;

		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const [form, panel] = [await box('form-page-main'), await box('form-page-panel')];
		expect(panel.x).toBeGreaterThan(form.x + form.width);
		expect(Math.abs(panel.y - form.y)).toBeLessThan(2);

		await page.setViewportSize({ width: WIDTHS.narrow, height: 900 });
		const [narrowForm, narrowPanel] = [await box('form-page-main'), await box('form-page-panel')];
		const danger = await page.getByRole('heading', { name: 'Zona berbahaya' }).boundingBox();
		expect(narrowPanel.y).toBeGreaterThan(narrowForm.y + narrowForm.height);
		expect(danger!.y).toBeGreaterThan(narrowPanel.y + narrowPanel.height);
	});

	test('a next step lands on its place, opening Lanjutan for the release command', async ({
		page
	}) => {
		await mockState(page, 'on-new');
		await page.setViewportSize({ width: WIDTHS.wide, height: 900 });
		await page.goto(SETTINGS_URL);
		await settled(page);
		const steps = page.getByTestId('settings-next-steps').getByRole('link');
		await expect(steps).toHaveText([
			'Atur release command',
			'Pasang custom domain',
			'Tambah worker antrean'
		]);
		await steps.first().click();
		await expect(page.getByRole('textbox', { name: 'Release command' })).toBeInViewport();
		await steps.nth(2).click();
		await expect(page.getByTestId('processes-section')).toBeInViewport();
	});

	test('with the flags off the panel asks for no domain, worker, or schedule', async ({ page }) => {
		const calls: string[] = [];
		page.on('request', (request) => {
			if (/\/(domains|processes|schedules)(\?|$)/.test(new URL(request.url()).pathname)) {
				calls.push(request.url());
			}
		});
		await mockState(page, 'off');
		await page.goto(SETTINGS_URL);
		await settled(page);
		await expect(page.getByTestId('settings-summary')).toBeVisible();
		await expect(page.getByTestId('settings-next-steps')).toHaveCount(0);
		expect(calls).toEqual([]);
	});
});
