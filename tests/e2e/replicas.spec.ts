import { expect, test } from '@playwright/test';
import { baseProject, mockProjectApi, PROJECT_ID } from './fixtures/project-detail';

const MAX_REPLICAS = 4;

test.describe('replicas', () => {
	test('setting 3 replicas saves them and says the project needs a redeploy', async ({
		page
	}, testInfo) => {
		let project: Record<string, unknown> = { ...baseProject, max_replicas: MAX_REPLICAS };
		let body: Record<string, unknown> | undefined;
		await mockProjectApi(page, {
			project: () => project,
			updateProject: (json) => {
				body = json;
				project = { ...project, ...json, redeploy_required: true };
				return { body: { data: project } };
			}
		});

		await page.goto(`/projects/${PROJECT_ID}/settings/build`);
		// Replicas sit in Lanjutan, closed while the project runs the default one.
		await page.getByRole('button', { name: 'Lanjutan' }).click();
		const field = page.getByRole('spinbutton', { name: 'Replika' });
		await expect(field).toHaveValue('1');

		await field.fill('3');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect(page.getByText(/perlu redeploy/)).toBeVisible();
		expect(body).toEqual({ replicas: 3 });
		await expect(field).toHaveValue('3');
		await page.screenshot({ path: testInfo.outputPath('replicas-settings.png') });
	});

	test('a project serving 2 of 3 healthy replicas shows it next to the status', async ({
		page
	}, testInfo) => {
		await mockProjectApi(page, {
			project: () => ({
				...baseProject,
				replicas: 3,
				max_replicas: MAX_REPLICAS,
				serving_replicas: 3,
				replicas_ready: 2
			})
		});

		await page.goto(`/projects/${PROJECT_ID}/deployments`);

		await expect(page.getByText('Live', { exact: true })).toBeVisible();
		await expect(page.getByTestId('project-replica-health')).toHaveText('2/3 replika sehat');
		await page.screenshot({ path: testInfo.outputPath('replicas-header.png') });
	});
});
