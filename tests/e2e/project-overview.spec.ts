import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import {
	baseProject,
	failedDeployment,
	mockProjectApi,
	PROJECT_ID,
	sampleMetrics,
	succeededDeployment,
	type ApiHandlers
} from './fixtures/project-detail';

const OVERVIEW_URL = `/projects/${PROJECT_ID}`;
const WIDTHS = [1440, 320] as const;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function deployment(sequence: number, overrides: Record<string, unknown> = {}) {
	return {
		...succeededDeployment,
		id: `dep-${sequence}`,
		sequence,
		commit_sha: `${sequence}f3c9d1e2b4a`,
		commit_message: `feat: perubahan nomor ${sequence}`,
		created_at: hoursAgo(10 - sequence),
		started_at: hoursAgo(10 - sequence),
		finished_at: new Date(Date.parse(hoursAgo(10 - sequence)) + 47_000).toISOString(),
		...overrides
	};
}

const history = [
	deployment(6, { trigger: 'webhook', commit_message: 'fix: perbaiki halaman menu' }),
	deployment(5, { ...failedDeployment, id: 'dep-5', sequence: 5, created_at: hoursAgo(5) }),
	deployment(4, { trigger: 'manual' }),
	deployment(3, { trigger: 'webhook' }),
	deployment(2, { trigger: 'redeploy' }),
	deployment(1, { trigger: 'manual', commit_message: null })
];

const variables = ['DATABASE_URL', 'APP_KEY', 'MAIL_HOST'].map((key, index) => ({
	id: index + 1,
	key,
	is_secret: true,
	created_at: '2026-01-01T00:00:00Z'
}));

const laravelInspection = {
	repository_url: baseProject.repository_url,
	commit_sha: 'a3f2c9d',
	dockerfile_found: false,
	env_example_found: true,
	compose_found: false,
	manifests: ['composer.json'],
	package_manager: 'composer',
	inspected_at: '2026-11-19T01:00:00Z'
};

const laravelStack = {
	builder: 'railpack',
	provider: 'php',
	framework: 'laravel',
	package_manager: 'composer'
};

const emptyMetrics = {
	data: {
		range: '24h',
		step_seconds: 900,
		series: {
			cpu_percent: [],
			memory_bytes: [],
			memory_limit_bytes: null,
			replicas: [],
			restarts: []
		}
	}
};

type OverviewState = { name: string; handlers: ApiHandlers };

const live = {
	...baseProject,
	replicas: 2,
	max_replicas: 3,
	serving_replicas: 2,
	replicas_ready: 2,
	release_command: 'php artisan migrate --force',
	stack: laravelStack,
	auto_deploy: false
};

const STATES: OverviewState[] = [
	{
		name: 'live',
		handlers: {
			project: () => live,
			deploymentList: () => history,
			envList: () => variables
		}
	},
	{
		name: 'replicas-partial',
		handlers: {
			project: () => ({ ...live, replicas: 3, serving_replicas: 3, replicas_ready: 2 }),
			deploymentList: () => history,
			envList: () => variables
		}
	},
	{
		name: 'sleeping',
		handlers: {
			project: () => ({ ...live, runtime_status: 'sleeping', replicas_ready: null }),
			deploymentList: () => history,
			envList: () => variables
		}
	},
	{
		name: 'failed',
		handlers: {
			project: () => ({
				...baseProject,
				status: 'draft',
				runtime_status: 'failed',
				active_deployment_id: null,
				serving_replicas: null,
				last_deployed_at: null
			}),
			deploymentList: () => [{ ...failedDeployment, id: 'dep-1', sequence: 1 }],
			envList: () => variables.slice(0, 1),
			metrics: () => ({ body: emptyMetrics })
		}
	},
	{
		name: 'never-deployed',
		handlers: {
			project: () => ({
				...baseProject,
				status: 'draft',
				runtime_status: 'not_deployed',
				active_deployment_id: null,
				serving_replicas: null,
				last_deployed_at: null,
				auto_deploy: false,
				max_replicas: 3,
				stack: laravelStack,
				inspection: laravelInspection
			}),
			deploymentList: () => [],
			envList: () => []
		}
	},
	{
		name: 'no-metrics',
		handlers: {
			project: () => ({ ...baseProject, region: 'id-jkt' }),
			deploymentList: () => history.slice(0, 2),
			envList: () => variables,
			metrics: () => ({ body: emptyMetrics })
		}
	}
];

/** The shell scrolls inside `main`, so the viewport grows to the content for a whole-page shot. */
async function capture(page: Page, testInfo: TestInfo, name: string, width: number) {
	const height = await page.evaluate(() => {
		const main = document.querySelector('main');
		return main ? Math.ceil(main.getBoundingClientRect().top + main.scrollHeight) : 0;
	});
	await page.setViewportSize({ width, height: Math.max(900, height + 48) });
	await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
	// The rendered page, for the HTML audit (`audit_html.py`) a reviewer may run on it.
	await writeFile(testInfo.outputPath(`${name}.html`), await page.content());
}

async function openOverview(page: Page) {
	await page.goto(OVERVIEW_URL);
	await expect(page.getByTestId('project-overview')).toBeVisible();
	await page.waitForLoadState('networkidle');
}

test.describe('project overview', () => {
	for (const state of STATES) {
		test(`${state.name} fits 1440 and 320 px`, async ({ page }, testInfo) => {
			await mockProjectApi(page, { metrics: () => ({ body: sampleMetrics() }), ...state.handlers });
			for (const width of WIDTHS) {
				await page.setViewportSize({ width, height: 900 });
				await openOverview(page);
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth > document.documentElement.clientWidth
				);
				expect(overflow, `${state.name} at ${width} px scrolls sideways`).toBe(false);
				await capture(page, testInfo, `overview-${state.name}-${width}`, width);
			}
		});
	}

	test('is the project page, first in the tabs, and Riwayat keeps its own address', async ({
		page
	}) => {
		await mockProjectApi(page, STATES[0].handlers);
		await openOverview(page);

		const tabs = page.getByRole('navigation', { name: 'Bagian proyek' }).getByRole('link');
		await expect(tabs).toHaveText(['Ringkasan', 'Riwayat', 'Metrik', 'Variabel', 'Pengaturan']);
		await expect(tabs.first()).toHaveAttribute('aria-current', 'page');
		await expect(page).toHaveTitle(/^Ringkasan · toko-kopi-web · Sakala$/);

		await page.getByRole('link', { name: 'Riwayat', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`${OVERVIEW_URL}/deployments$`));
		await expect(page.getByRole('link', { name: 'Riwayat', exact: true })).toHaveAttribute(
			'aria-current',
			'page'
		);
		await expect(page.getByRole('link', { name: 'Ringkasan', exact: true })).not.toHaveAttribute(
			'aria-current'
		);
	});

	test('the canvas reads in visiting order, is described in words, and explains a block on demand', async ({
		page
	}, testInfo) => {
		await mockProjectApi(page, STATES[1].handlers);
		await openOverview(page);

		const path = page.getByRole('list', { name: 'Jalur dari alamat ke aplikasi' });
		await expect(path.getByRole('list', { name: 'Jaringan' }).getByRole('listitem')).toHaveText([
			/Alamat\s*toko-kopi-web\.sakala\.app/,
			/Sakala Edge\s*aktif/
		]);
		await expect(
			path.getByRole('list', { name: 'Region otomatis' }).getByRole('listitem')
		).toHaveText([/Node\s*otomatis/, /Aplikasi\s*Live\s*port 3000/]);
		await expect(page.getByRole('img', { name: '2 dari 3 replika sehat' })).toHaveText('2/3');
		await expect(page.getByRole('region', { name: 'Alur pengunjung' })).toHaveAccessibleDescription(
			'Pengunjung membuka toko-kopi-web.sakala.app, lalu Sakala Edge meneruskannya ke node di region yang dipilih otomatis, tempat aplikasi berjalan dengan 2 dari 3 replika sehat di port 3000. Aplikasi memakai 3 environment variable dan menjalankan release command sebelum setiap versi baru menerima trafik.'
		);
		// Connectors are drawing only; the lists and the description carry the order.
		for (const connector of await page.locator('.connector').all()) {
			await expect(connector).toHaveAttribute('aria-hidden', 'true');
		}

		// Details on demand, by keyboard: Enter opens, Esc closes and gives focus back.
		const app = page.getByTestId('topology-block-app');
		await app.focus();
		await page.keyboard.press('Enter');
		const detail = page.getByRole('dialog', { name: 'Aplikasi' });
		await expect(detail).toContainText('1 replika belum lolos health check.');
		await expect(app).toHaveAttribute('aria-expanded', 'true');
		for (const width of WIDTHS) {
			await page.setViewportSize({ width, height: 900 });
			await expect(detail).toBeInViewport();
			await page.screenshot({ path: testInfo.outputPath(`overview-detail-app-${width}.png`) });
		}
		await page.keyboard.press('Escape');
		await expect(detail).toBeHidden();
		await expect(app).toBeFocused();

		await page.getByTestId('topology-block-variables').click();
		await page
			.getByRole('dialog', { name: 'Environment variable' })
			.getByRole('link', { name: 'Buka Variabel' })
			.click();
		await expect(page).toHaveURL(new RegExp(`${OVERVIEW_URL}/environments$`));
	});

	test('a hidden suggestion stays hidden for this project after a reload', async ({ page }) => {
		await mockProjectApi(page, STATES[4].handlers);
		await openOverview(page);

		const steps = page.getByTestId('overview-next-steps').getByRole('listitem');
		await expect(steps).toHaveCount(3);
		await page.getByRole('button', { name: 'Sembunyikan langkah Nyalakan auto-deploy' }).click();
		await expect(steps).toHaveCount(3);
		await expect(page.getByTestId('overview-next-steps-auto-deploy')).toHaveCount(0);
		// The step that took its place gets the focus, and the hidden one can be brought back.
		await expect(
			page.getByRole('button', { name: 'Sembunyikan langkah Tambah replika' })
		).toBeFocused();
		await expect(page.getByTestId('panel-restore-steps')).toBeVisible();

		await page.reload();
		await expect(page.getByTestId('project-overview')).toBeVisible();
		await expect(page.getByTestId('overview-next-steps-replicas')).toBeVisible();
		await expect(page.getByTestId('overview-next-steps-auto-deploy')).toHaveCount(0);
	});

	test('the next steps link to the field they are about', async ({ page }) => {
		await mockProjectApi(page, STATES[4].handlers);
		await openOverview(page);

		await page.getByRole('link', { name: 'Atur release command' }).click();
		await expect(page).toHaveURL(new RegExp(`${OVERVIEW_URL}/settings/build#releaseCommand$`));
		await expect(page.locator('#releaseCommand')).toBeInViewport();
	});
});
