import { expect, test, type Page } from '@playwright/test';
import {
	baseProject,
	DEPLOYMENT_ID,
	DETAIL_URL,
	mockProjectApi,
	PROJECT_ID,
	succeededDeployment
} from './fixtures/project-detail';

const SOURCE_ID = '01a0cd92-b2e0-7327-97a1-d688062f3002';
const PROJECT_URL = `/projects/${PROJECT_ID}`;
const RIWAYAT_URL = `/projects/${PROJECT_ID}/deployments`;

const reusedBuild = {
	mode: 'reused',
	image_source_deployment_id: SOURCE_ID,
	image_source_sequence: 2,
	fallback_reason: null
};

/** A moment of the last minute, so the steps and the deployment share one clock. */
const at = (seconds: number) => new Date(Date.now() - (60 - seconds) * 1_000).toISOString();
const lastMinute = { created_at: at(0), started_at: at(1), finished_at: at(45) };

const reusedDeployment = { ...succeededDeployment, ...lastMinute, build: reusedBuild };

const fallbackDeployment = {
	...succeededDeployment,
	...lastMinute,
	build: { ...reusedBuild, mode: 'built', fallback_reason: 'image_missing' }
};

const reusedEvents = [
	{ type: 'deployment.image.reused', level: 'info', seconds: 3 },
	{ type: 'deployment.container.started', level: 'info', seconds: 9 },
	{ type: 'deployment.health.started', level: 'info', seconds: 12 },
	{ type: 'deployment.route.started', level: 'info', seconds: 15 }
].map((event, index) => ({
	sequence: index + 1,
	level: event.level,
	type: event.type,
	message: event.type,
	metadata: null,
	occurred_at: at(event.seconds)
}));

const fallbackEvents = [
	{ type: 'deployment.image.reuse_skipped', level: 'warning', seconds: 2 },
	{ type: 'deployment.checkout.started', level: 'info', seconds: 3 },
	{ type: 'deployment.build.started', level: 'info', seconds: 10 },
	{ type: 'deployment.container.started', level: 'info', seconds: 40 }
].map((event, index) => ({
	sequence: index + 1,
	level: event.level,
	type: event.type,
	message: event.type,
	metadata: null,
	occurred_at: at(event.seconds)
}));

/** Every redeploy body the Console sent. */
function captureRedeploys(page: Page): Record<string, unknown>[] {
	const bodies: Record<string, unknown>[] = [];
	page.on('request', (request) => {
		if (request.method() === 'POST' && /\/projects\/[^/]+\/deployments\/?$/.test(request.url())) {
			bodies.push(request.postDataJSON() as Record<string, unknown>);
		}
	});
	return bodies;
}

test.describe('a deployment that reused an image', () => {
	test('shows the image step in place of clone and build, linked to its source', async ({
		page
	}) => {
		await mockProjectApi(page, { deployment: () => reusedDeployment, events: () => reusedEvents });
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(DETAIL_URL);

		const steps = page.getByRole('complementary', { name: 'Tahapan dan info' });
		await expect(steps).toContainText('Memakai image dari deployment #2 (tanpa build)');
		await expect(steps.getByRole('link', { name: '#2', exact: true })).toHaveAttribute(
			'href',
			`/projects/${PROJECT_ID}/deployments/${SOURCE_ID}`
		);
		await expect(steps).not.toContainText('Menyalin repository');
		await expect(steps).not.toContainText('Build proyek');
		await expect(page.getByTestId('image-fallback-note')).toHaveCount(0);
	});

	test('says the source was deleted when it is gone', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => ({
				...reusedDeployment,
				build: { ...reusedBuild, image_source_deployment_id: null, image_source_sequence: null }
			}),
			events: () => reusedEvents
		});
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(DETAIL_URL);

		const steps = page.getByRole('complementary', { name: 'Tahapan dan info' });
		await expect(steps).toContainText(
			'Memakai image dari deployment yang sudah dihapus (tanpa build)'
		);
		await expect(steps.getByRole('link', { name: /^#/ })).toHaveCount(0);
	});
});

test.describe('a deployment that built after a planned reuse', () => {
	test('says calmly why it built, beside the build steps', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => fallbackDeployment,
			events: () => fallbackEvents
		});
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(DETAIL_URL);

		const note = page.getByTestId('image-fallback-note');
		await expect(note).toHaveText(
			'Image dari deployment #2 sudah tidak ada di server, jadi Sakala menjalankan build dari awal.'
		);
		await expect(note.getByRole('link', { name: '#2' })).toHaveAttribute(
			'href',
			`/projects/${PROJECT_ID}/deployments/${SOURCE_ID}`
		);
		await expect(note).not.toHaveAttribute('role', 'alert');
		const steps = page.getByRole('complementary', { name: 'Tahapan dan info' });
		await expect(steps).toContainText('Menyalin repository');
		await expect(steps).toContainText('Build proyek');
		await expect(page.getByRole('heading', { name: 'Deployment berhasil' })).toBeVisible();
	});
});

test.describe('Redeploy and "Build ulang dari awal"', () => {
	test('Redeploy leaves the choice to the API, and the menu asks for a full build', async ({
		page
	}) => {
		const bodies = captureRedeploys(page);
		await mockProjectApi(page);
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(PROJECT_URL);
		await page.getByRole('button', { name: 'Redeploy', exact: true }).click();
		await expect(page).toHaveURL(/\/deployments\/[^/]+$/);
		expect(bodies).toEqual([{ branch: 'main' }]);

		await page.goto(PROJECT_URL);
		// The project runs, so the same menu holds Restart and is named for both.
		await page.getByRole('button', { name: 'Pilihan build dan restart' }).click();
		const menu = page.getByRole('menu');
		await expect(menu).toContainText(
			'Memakai ulang image yang sedang dipakai kalau commit, pengaturan build, dan variabel yang dibaca saat build tidak berubah'
		);
		await menu.getByRole('menuitem', { name: 'Build ulang dari awal' }).click();
		await expect(page).toHaveURL(/\/deployments\/[^/]+$/);
		expect(bodies).toEqual([{ branch: 'main' }, { branch: 'main', force_build: true }]);
	});

	test('a failed deployment offers the same choice', async ({ page }) => {
		const bodies = captureRedeploys(page);
		await mockProjectApi(page, {
			deployment: () => ({
				...succeededDeployment,
				status: 'failed',
				is_active: false,
				failure: null
			})
		});
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Pilihan cara build' }).click();
		await page.getByRole('menuitem', { name: 'Build ulang dari awal' }).click();

		await expect.poll(() => bodies).toEqual([{ branch: 'main', force_build: true }]);
	});

	test('a project with no live image has no menu: every redeploy builds', async ({ page }) => {
		await mockProjectApi(page, {
			// Only failed deploys so far: nothing is live, so nothing can be reused.
			project: () => ({ ...baseProject, active_deployment_id: null, runtime_status: 'stopped' })
		});
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(PROJECT_URL);

		await expect(page.getByRole('button', { name: /Redeploy|Deploy sekarang/ })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pilihan cara build' })).toHaveCount(0);
	});
});

test.describe('Riwayat', () => {
	for (const width of [1440, 320]) {
		test(`labels a reused deployment in words at ${width} px`, async ({ page }) => {
			await mockProjectApi(page, {
				deploymentList: () => [
					{ ...reusedDeployment, id: DEPLOYMENT_ID, sequence: 3 },
					{ ...succeededDeployment, id: SOURCE_ID, sequence: 2, is_active: false }
				]
			});
			await page.setViewportSize({ width, height: 800 });

			await page.goto(RIWAYAT_URL);

			const label = page.getByTestId('deployment-row-reuse');
			await expect(label).toHaveCount(1);
			await expect(label).toHaveText('Tanpa build · image #2');
			await expect(label).toBeInViewport();
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});
	}
});

test.describe('Variabel tab: what the next redeploy does, before saving', () => {
	const VARIABLES_URL = `/projects/${PROJECT_ID}/environments`;
	const variableChanges = {
		requires_build: false,
		reason: null,
		build_time_prefixes: ['NEXT_PUBLIC_', 'VITE_', 'PUBLIC_'],
		build_time_keys: ['NODE_ENV']
	};
	const stack = (framework: string) => ({
		builder: 'railpack',
		provider: 'node',
		framework,
		package_manager: 'npm',
		monorepo: null
	});

	for (const width of [1440, 320]) {
		test(`a static site says the change builds, beside Simpan, at ${width} px`, async ({
			page
		}) => {
			await mockProjectApi(page, {
				project: () => ({
					...baseProject,
					stack: stack('vite'),
					variable_changes: { ...variableChanges, requires_build: true, reason: 'static_site' }
				})
			});
			await page.setViewportSize({ width, height: 800 });

			await page.goto(VARIABLES_URL);
			await page.getByRole('button', { name: 'Tambah variabel' }).click();
			await page.getByLabel('Nama variabel').fill('API_URL');

			const hint = page.getByTestId('variable-build-hint');
			const expected =
				'Perubahan ini butuh build ulang karena situs ini disajikan sebagai file statis, jadi nilai variabel ikut tersimpan di hasil build.';
			await expect(hint).toHaveText(expected);
			await expect(hint).toBeInViewport();
			await expect(
				page.getByRole('button', { name: 'Simpan', exact: true })
			).toHaveAccessibleDescription(expected);
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow).toBeLessThanOrEqual(0);
		});
	}

	test('a plain server reuses the image for a runtime key and builds for a prefix', async ({
		page
	}) => {
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				stack: stack('express'),
				variable_changes: variableChanges
			})
		});
		await page.setViewportSize({ width: 1440, height: 900 });

		await page.goto(VARIABLES_URL);
		await page.getByRole('button', { name: 'Tambah variabel' }).click();
		await page.getByLabel('Nama variabel').fill('API_URL');

		const hint = page.getByTestId('variable-build-hint');
		await expect(hint).toHaveText('Cukup restart dengan image yang sama (tanpa build).');

		await page.getByLabel('Nama variabel').fill('VITE_API_URL');
		await expect(hint).toHaveText(
			'Perubahan ini butuh build ulang karena variabel berawalan VITE_ dibaca saat build.'
		);
	});
});
