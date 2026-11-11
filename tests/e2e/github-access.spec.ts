import { expect, test, type Page } from '@playwright/test';
import { DEPLOYMENT_ID, PROJECT_ID, mockWizardApi, type Reply } from './fixtures/create-project';
import {
	DETAIL_URL,
	baseProject,
	failedDeployment,
	mockProjectApi
} from './fixtures/project-detail';

const MESSAGE =
	'Sakala sedang mencapai batas permintaan ke GitHub. Ini bukan masalah di repository kamu. Coba lagi beberapa saat lagi.';
const SHOWN = `${MESSAGE} Bisa dicoba lagi dalam 2 menit.`;

const limited: Reply = {
	status: 503,
	headers: { 'Retry-After': '120', 'Access-Control-Expose-Headers': 'Retry-After' },
	body: { message: MESSAGE, code: 'GITHUB_RATE_LIMITED', retry_after: 120 }
};

async function toConfigureStep(page: Page) {
	await page.getByRole('radio', { name: /rani\/repo-1\b/ }).click();
	await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
}

test.describe('GitHub rate limit (GITHUB_RATE_LIMITED)', () => {
	test('the repository list says so, and does not ask GitHub twice', async ({ page }) => {
		let asked = 0;
		await mockWizardApi(page, {
			repositories: () => {
				asked += 1;
				return limited;
			}
		});

		await page.goto('/projects/new');

		await expect(page.getByText(SHOWN)).toBeVisible();
		expect(asked).toBe(1);
	});

	test('validating a public repository says so', async ({ page }) => {
		await mockWizardApi(page, { validate: () => limited });
		await page.goto('/projects/new');

		await page.getByRole('button', { name: 'Public Git URL', exact: true }).click();
		await page.getByLabel('URL repository publik').fill('https://github.com/publik/situs');
		await page.getByRole('button', { name: 'Lanjut', exact: true }).click();

		await expect(page.getByText(SHOWN)).toBeVisible();
		await expect(page.getByText('Terjadi kesalahan pada server')).toHaveCount(0);
	});

	test('the branch list says so, and keeps the default branch', async ({ page }) => {
		await mockWizardApi(page, { branches: () => limited });
		await page.goto('/projects/new');

		await toConfigureStep(page);

		await expect(page.getByText(SHOWN)).toBeVisible();
		await expect(page.getByLabel('Branch', { exact: true })).toHaveValue('main');
	});

	test('Redeploy from a project tab says so', async ({ page }) => {
		await mockProjectApi(page, { redeploy: () => limited });

		await page.goto(`/projects/${PROJECT_ID}/deployments`);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert')).toHaveText(SHOWN);
	});

	test('Redeploy from a failed deployment says so', async ({ page }) => {
		await mockProjectApi(page, {
			deployment: () => ({ ...failedDeployment, id: DEPLOYMENT_ID }),
			redeploy: () => limited
		});

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert').filter({ hasText: 'batas permintaan' })).toHaveText(SHOWN);
	});
});

test.describe('repository access revoked', () => {
	const REVOKED = 'Pemilik project tidak lagi punya akses ke repository ini di GitHub.';
	const revoked: Reply = {
		status: 409,
		body: { message: REVOKED, code: 'REPOSITORY_ACCESS_REVOKED' }
	};

	test('Redeploy shows the API message for REPOSITORY_ACCESS_REVOKED', async ({ page }) => {
		await mockProjectApi(page, { redeploy: () => revoked });

		await page.goto(`/projects/${PROJECT_ID}/deployments`);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('alert')).toHaveText(REVOKED);
	});

	function failedWith(code: string, summary: string, hint: string, userFixable: boolean) {
		return {
			...failedDeployment,
			failure_code: code,
			failure_summary: summary,
			failure: {
				code,
				category: 'checkout',
				summary,
				recovery_hint: hint,
				user_fixable: userFixable,
				detail: null,
				stage: 'checkout'
			}
		};
	}

	test('repository_access_revoked is shown as something the user can fix', async ({ page }) => {
		const hint = 'Minta pemilik repository memulihkan akses kamu, lalu deploy ulang.';
		await mockProjectApi(page, {
			deployment: () => failedWith('repository_access_revoked', REVOKED, hint, true)
		});

		await page.goto(DETAIL_URL);

		await expect(
			page.getByRole('heading', { name: 'Deployment gagal saat mengambil source code' })
		).toBeVisible();
		await expect(page.getByText('repository_access_revoked')).toBeVisible();
		await expect(page.getByText(REVOKED)).toBeVisible();
		await expect(page.getByText(/Cara memperbaiki/)).toBeVisible();
		await expect(page.getByText(hint)).toBeVisible();
	});

	test('repository_access_check_failed does not blame the user', async ({ page }) => {
		const summary = 'Sakala tidak bisa memeriksa akses repository ke GitHub saat ini.';
		const hint = 'Coba deploy ulang beberapa saat lagi.';
		await mockProjectApi(page, {
			deployment: () => failedWith('repository_access_check_failed', summary, hint, false)
		});

		await page.goto(DETAIL_URL);

		await expect(page.getByText('repository_access_check_failed')).toBeVisible();
		await expect(page.getByText(summary)).toBeVisible();
		await expect(page.getByText(/kendala di sisi platform Sakala/)).toBeVisible();
		await expect(page.getByText(/Cara memperbaiki/)).toHaveCount(0);
		await expect(page.getByText(hint)).toBeVisible();
	});
});

test.describe('public_url', () => {
	test('links to the URL the API sends, with its scheme and port', async ({ page }) => {
		const url = 'http://toko-kopi-web.apps.localhost:8080';
		await mockProjectApi(page, { project: () => ({ ...baseProject, public_url: url }) });

		await page.goto(`/projects/${PROJECT_ID}/deployments`);

		await expect(page.getByRole('link', { name: 'Buka situs' })).toHaveAttribute('href', url);
		await expect(page.getByText('toko-kopi-web.apps.localhost:8080')).toBeVisible();
	});

	test('says it is unavailable when the API sends none, without guessing from the domain', async ({
		page
	}) => {
		await mockProjectApi(page, { project: () => ({ ...baseProject, public_url: null }) });

		await page.goto(`/projects/${PROJECT_ID}/deployments`);

		await expect(page.getByText('URL publik belum tersedia')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buka situs' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Salin URL' })).toHaveCount(0);
	});
});

test.describe('auto-deploy on a Public URL project', () => {
	const publicProject = {
		...baseProject,
		repository_source: 'public_url',
		github_installation_id: null,
		github_repository_id: null,
		auto_deploy: false
	};

	test('settings cannot turn it on, and saving never sends it', async ({ page }) => {
		const updates: unknown[] = [];
		await mockProjectApi(page, {
			project: () => publicProject,
			updateProject: (body) => {
				updates.push(body);
				return { body: { data: { ...publicProject, ...body } } };
			}
		});

		await page.goto(`/projects/${PROJECT_ID}/settings`);

		const toggle = page.getByRole('switch', { name: 'Auto-deploy' });
		await expect(toggle).toBeDisabled();
		await expect(toggle).toHaveAttribute('aria-checked', 'false');

		await page.getByLabel('Start command').fill('node server.js');
		await page.getByRole('button', { name: 'Simpan perubahan' }).click();

		await expect.poll(() => updates).toEqual([{ start_command: 'node server.js' }]);
	});
});
