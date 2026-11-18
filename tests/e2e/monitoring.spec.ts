import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { baseProject, mockProjectApi, PROJECT_ID, sampleMetrics } from './fixtures/project-detail';

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
});
