import { expect, test } from '@playwright/test';
import { pilotLimits } from './fixtures/create-project';
import {
	baseProject,
	mockProjectApi,
	personalWorkspace,
	PROJECT_ID,
	succeededDeployment
} from './fixtures/project-detail';

const IDLE_SLEEP_MINUTES = 30;

test.describe('idle sleep', () => {
	test('a sleeping project shows Tidur, and Bangunkan brings it back to Live', async ({
		page
	}, testInfo) => {
		let woken = false;
		let wakes = 0;
		await mockProjectApi(page, {
			// The API answers the wake with the project still asleep; the node reports later.
			project: () => ({ ...baseProject, runtime_status: woken ? 'running' : 'sleeping' }),
			deploymentList: () => [succeededDeployment],
			wake: () => {
				wakes += 1;
				woken = true;
				return { status: 202, body: { data: { ...baseProject, runtime_status: 'sleeping' } } };
			}
		});
		// The membership the idle window is read for, with the counts the real list sends.
		await page.route(/\/api\/v1\/app\/workspaces(\?.*)?$/, (route) =>
			route.fulfill({
				json: { data: [{ ...personalWorkspace, projects_count: 1, active_deployments_count: 0 }] }
			})
		);
		await page.route(/\/api\/v1\/app\/pilot-limits(\?.*)?$/, (route) =>
			route.fulfill({
				json: { data: { ...pilotLimits, project_idle_sleep_minutes: IDLE_SLEEP_MINUTES } }
			})
		);

		await page.goto(`/projects/${PROJECT_ID}/deployments`);

		await expect(page.getByText('Tidur', { exact: true })).toBeVisible();
		await expect(
			page.getByText(
				`Proyek ini sedang tidur karena tidak ada pengunjung selama ${IDLE_SLEEP_MINUTES} menit.`
			)
		).toBeVisible();
		await expect(page.getByTestId('project-public-url')).toHaveAttribute(
			'href',
			baseProject.public_url
		);
		await page.screenshot({ path: testInfo.outputPath('sleeping-banner.png') });

		await page.getByRole('button', { name: 'Bangunkan' }).click();

		await expect.poll(() => wakes).toBe(1);
		await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Bangunkan' })).toHaveCount(0);
		expect(wakes).toBe(1);
	});
});
