import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
	baseProject,
	mockProjectApi,
	PROJECT_ID,
	sampleMetrics,
	succeededDeployment
} from './fixtures/project-detail';

const MONITORING_URL = `/projects/${PROJECT_ID}/monitoring`;
const CHART_NAMES = ['CPU', 'Memori', 'Replika', 'Restart'];

test.describe('monitoring', () => {
	test('the tab shows four charts for a day, and reads another range', async ({
		page
	}, testInfo) => {
		// Tall enough for all four cards in the screenshot.
		await page.setViewportSize({ width: 1280, height: 1100 });
		const ranges: string[] = [];
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'running' }),
			metrics: (url) => {
				ranges.push(url.searchParams.get('range') ?? '');
				return { body: sampleMetrics() };
			}
		});
		await page.goto(`/projects/${PROJECT_ID}/deployments`);
		await page.getByRole('link', { name: 'Metrik', exact: true }).click();
		await expect(page).toHaveURL(new RegExp(`${MONITORING_URL}$`));

		for (const name of CHART_NAMES) {
			await expect(page.getByRole('figure', { name })).toBeVisible();
		}
		await expect(page.getByRole('radio', { name: '24 jam' })).toBeChecked();
		await expect(page.locator('figure canvas')).toHaveCount(4);
		await expect(page.getByRole('figure', { name: 'Memori' })).toContainText(
			'Batas 1 GiB untuk 2 replika (512 MiB per replika).'
		);
		await page.screenshot({ path: testInfo.outputPath('monitoring-24h.png'), fullPage: true });
		// The rendered page, for the HTML audit (`audit_html.py`) a reviewer may run on it.
		await writeFile(testInfo.outputPath('monitoring-24h.html'), await page.content());

		await page.getByRole('radio', { name: '7 hari' }).click();
		await expect(page.getByRole('figure', { name: 'CPU' })).toHaveAccessibleDescription(
			/7 hari terakhir/
		);
		expect(ranges).toEqual(['24h', '7d']);
		// The range is in the address, so it can be shared, and Back goes to the previous one.
		await expect(page).toHaveURL(new RegExp(`${MONITORING_URL}\\?range=7d$`));
		await page.goBack();
		await expect(page.getByRole('radio', { name: '24 jam' })).toBeChecked();
		await expect(page).toHaveURL(new RegExp(`${MONITORING_URL}$`));
	});

	test('a shared link opens on its range', async ({ page }) => {
		await mockProjectApi(page);
		await page.goto(`${MONITORING_URL}?range=6h`);

		await expect(page.getByRole('radio', { name: '6 jam' })).toBeChecked();
		await expect(page.getByRole('figure', { name: 'CPU' })).toHaveAccessibleDescription(
			/6 jam terakhir/
		);
	});

	test('fits a phone, and says a sleeping project collects nothing', async ({ page }, testInfo) => {
		await page.setViewportSize({ width: 320, height: 800 });
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, runtime_status: 'sleeping' })
		});
		await page.goto(MONITORING_URL);

		await expect(page.getByText(/Selama proyek tidur, metrik tidak dicatat/)).toBeVisible();
		await expect(page.locator('figure canvas')).toHaveCount(4);
		await page.screenshot({ path: testInfo.outputPath('monitoring-320.png'), fullPage: true });
	});

	test('a project without samples yet shows the empty state', async ({ page }, testInfo) => {
		await mockProjectApi(page, {
			metrics: () => ({
				body: {
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
				}
			})
		});
		await page.goto(MONITORING_URL);

		await expect(
			page.getByRole('heading', { name: 'Belum ada data metrik dalam 24 jam terakhir' })
		).toBeVisible();
		await expect(
			page.getByText('Data muncul beberapa menit setelah proyek berjalan.')
		).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('monitoring-empty.png') });
	});

	test('a five-minute-old project opens on 1 hour, says when its data starts, and marks its deployment', async ({
		page
	}, testInfo) => {
		const now = Date.now();
		const ago = (seconds: number) => new Date(now - seconds * 1_000).toISOString();
		const STEP = 60;
		const points = [240, 180, 120, 60];
		const ranges: string[] = [];
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, created_at: ago(300), runtime_status: 'running' }),
			deploymentList: () => [
				{
					...succeededDeployment,
					id: 'dep-first',
					sequence: 1,
					commit_message: 'feat: halaman menu kopi\n\nDengan harga per cangkir',
					created_at: ago(290),
					started_at: ago(290),
					finished_at: ago(200)
				}
			],
			metrics: (url) => {
				ranges.push(url.searchParams.get('range') ?? '');
				return {
					body: {
						data: {
							range: '1h',
							step_seconds: STEP,
							series: {
								cpu_percent: points.map((s, i) => ({ t: ago(s), avg: 4 + i, max: 9 + i })),
								memory_bytes: points.map((s, i) => ({
									t: ago(s),
									avg: (80 + 6 * i) * 1024 * 1024,
									max: (96 + 6 * i) * 1024 * 1024
								})),
								memory_limit_bytes: 512 * 1024 * 1024,
								replicas: points.map((s) => ({ t: ago(s), count: 1 })),
								restarts: points.map((s) => ({ t: ago(s), count: 0 }))
							}
						}
					}
				};
			}
		});

		for (const [name, width, height] of [
			['1440', 1440, 1300],
			['390', 390, 2200]
		] as const) {
			await page.setViewportSize({ width, height });
			await page.goto(MONITORING_URL);

			await expect(page.getByRole('radio', { name: '1 jam' })).toBeChecked();
			await expect(page.getByTestId('metrics-data-start')).toHaveText(/^Data mulai /);
			const list = page.getByRole('region', { name: 'Penanda deployment' });
			await expect(list.getByRole('link', { name: 'Deployment #1' })).toBeVisible();
			await expect(list).toContainText('feat: halaman menu kopi');
			await expect(page.locator('figure canvas')).toHaveCount(4);

			// Hover the marker on the memory chart: its tooltip names the deployment.
			const over = page.locator('[data-testid="metric-memory"] .u-over');
			const box = (await over.boundingBox())!;
			const share = (3_600 - 200) / 3_600;
			await page.mouse.move(box.x + share * box.width, box.y + box.height / 2);
			const tooltip = page.getByTestId('chart-marker-tooltip').first();
			await expect(tooltip).toContainText('Deployment #1');
			await expect(tooltip).toContainText('feat: halaman menu kopi');
			await page.screenshot({
				path: testInfo.outputPath(`monitoring-new-project-${name}.png`),
				fullPage: true
			});
		}
		expect(ranges.every((range) => range === '1h')).toBe(true);
	});
});
