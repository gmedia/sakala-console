import { expect, test } from '@playwright/test';
import {
	createdProject,
	mockWizardApi,
	PROJECT_ID,
	succeededInspection
} from './fixtures/create-project';
import { DETAIL_URL, mockProjectApi, runningDeployment } from './fixtures/project-detail';

const HEADLINE = 'Monorepo pnpm terdeteksi — build dari root workspace, aplikasi dari apps/web';

const monorepo = {
	manager: 'pnpm',
	root_directory: '.',
	package_directory: 'apps/web',
	package_name: '@kopi/web',
	build_command: 'pnpm --filter @kopi/web run build',
	start_command: null,
	static_output_directory: 'apps/web/dist'
};

const event = (sequence: number, type: string, time: string, metadata: unknown = null) => ({
	sequence,
	level: 'info',
	type,
	message: type,
	metadata,
	occurred_at: `2026-09-20T08:41:${time}Z`
});

for (const width of [1280, 320]) {
	test.describe(`at ${width} px`, () => {
		test.use({ viewport: { width, height: 900 } });

		test('the detection result names the workspace and the derived commands', async ({ page }) => {
			await mockWizardApi(page, {
				project: () => ({
					...createdProject,
					...succeededInspection,
					stack: { ...succeededInspection.stack, builder: 'railpack', monorepo }
				})
			});
			await page.goto(`/projects/new?project=${PROJECT_ID}`);

			const summary = page.getByTestId('monorepo-summary');
			await expect(summary).toContainText(HEADLINE);
			await expect(summary).toContainText('root repository');
			await expect(summary).toContainText('@kopi/web (apps/web)');
			await expect(summary).toContainText('pnpm --filter @kopi/web run build');
			await expect(summary).toContainText('Disajikan sebagai situs statis dari apps/web/dist');
			await expect(summary).toContainText('diturunkan dari package.json');
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
			).toBe(false);
		});

		test('the deployment timeline shows the commands the deployment really used', async ({
			page
		}) => {
			const used = { ...monorepo, build_command: 'pnpm run build:web' };
			await mockProjectApi(page, {
				deployment: () => runningDeployment,
				events: () => [
					event(1, 'deployment.checkout.started', '02'),
					event(2, 'deployment.analysis.started', '05'),
					event(3, 'deployment.workspace.detected', '06', used),
					event(4, 'deployment.build.started', '08')
				]
			});
			await page.goto(DETAIL_URL);
			if (width < 1024) await page.getByRole('button', { name: /Tahapan/ }).click();

			const step = page.getByRole('listitem').filter({ hasText: 'Menganalisis proyek' });
			await expect(step.getByTestId('monorepo-summary')).toContainText(HEADLINE);
			await expect(step).toContainText('pnpm run build:web');
			await expect(page.getByTestId('monorepo-summary')).toHaveCount(1);
		});
	});
}

test('a project without a workspace shows nothing extra', async ({ page }) => {
	await mockWizardApi(page, {
		project: () => ({ ...createdProject, ...succeededInspection })
	});
	await page.goto(`/projects/new?project=${PROJECT_ID}`);

	await expect(page.getByText('Dockerfile terdeteksi')).toBeVisible();
	await expect(page.getByTestId('monorepo-summary')).toHaveCount(0);
});
