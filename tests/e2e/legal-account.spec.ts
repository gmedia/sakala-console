import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';
import { signedInUser } from './fixtures/all-routes';
import {
	baseProject,
	DETAIL_URL,
	failedDeployment,
	mockProjectApi,
	PROJECT_ID
} from './fixtures/project-detail';

const legal = {
	terms_version: 'syarat-v1',
	acceptable_use_version: 'penggunaan-wajar-v1',
	privacy_notice_version: 'privasi-v1'
};

const json = (route: Route, body: unknown, status = 200) =>
	route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockAccount(page: Page, overrides: Record<string, unknown> = {}) {
	let user = { ...signedInUser, ...overrides };
	await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
	await page.route('**/api/v1/auth/user', (route) => json(route, { data: user }));
	await page.route('**/api/v1/auth/options', (route) =>
		json(route, {
			data: { email_delivery_enabled: true, providers: { github: true, google: false }, legal }
		})
	);
	await page.route('**/api/v1/app/notifications/unread-count', (route) =>
		json(route, { data: { count: 0 } })
	);
	await page.route('**/api/v1/app/pilot-limits', (route) =>
		json(route, {
			data: {
				quotas: {
					max_projects_per_user: 3,
					max_active_deployments_per_user: 2,
					max_active_deployments_per_project: 1,
					current_projects_count: 0,
					current_active_deployments_count: 0
				},
				runtime_defaults: { memory_mb: 256, cpu_millis: 500, pids_limit: 128 },
				timeouts: {
					build_timeout_seconds: 600,
					start_timeout_seconds: 120,
					command_timeout_seconds: 900
				},
				deleted_project_retention_days: 45
			}
		})
	);
	return {
		accept: () => {
			user = { ...user, legal_acceptance_required: false };
			return user;
		}
	};
}

test.describe('accepting the terms', () => {
	test('a first GitHub login cannot reach the app until it accepts', async ({ page }) => {
		const account = await mockAccount(page, { legal_acceptance_required: true });
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/legal-acceptance', (route) => {
			bodies.push(route.request().postDataJSON());
			return json(route, { data: account.accept() });
		});
		await page.route(/\/api\/v1\/app\/projects(\?.*)?$/, (route) =>
			json(route, {
				data: [],
				links: { first: null, last: null, prev: null, next: null },
				meta: {
					current_page: 1,
					from: null,
					last_page: 1,
					links: [],
					path: null,
					per_page: 6,
					to: null,
					total: 0
				}
			})
		);

		await page.goto('/projects');

		await expect(page.getByRole('heading', { name: 'Satu langkah lagi' })).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Setuju dan lanjutkan' }).click();
		await expect(page.getByText(/Centang pernyataan ini dulu/)).toBeVisible();
		expect(bodies).toEqual([]);

		await page.getByRole('checkbox').check();
		await page.getByRole('button', { name: 'Setuju dan lanjutkan' }).click();

		await expect(page.getByRole('heading', { name: 'Buat proyek pertamamu' })).toBeVisible();
		expect(bodies).toEqual([
			{
				accept_terms: true,
				terms_version: 'syarat-v1',
				acceptable_use_version: 'penggunaan-wajar-v1'
			}
		]);
	});

	test('nobody has to agree first in order to leave', async ({ page }) => {
		await mockAccount(page, { legal_acceptance_required: true });
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
		);

		await page.goto('/projects');
		await page.getByRole('link', { name: 'Unduh data atau hapus akun' }).click();

		await expect(page).toHaveURL(/\/settings$/);
		await expect(page.getByRole('button', { name: 'Unduh data saya' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Hapus akun saya' })).toBeVisible();
	});

	test('terms that change mid-session bring the screen up when a deploy is refused', async ({
		page
	}) => {
		let required = false;
		await mockProjectApi(page, {
			deployment: () => failedDeployment,
			redeploy: () => {
				required = true;
				return {
					status: 403,
					body: {
						message: 'Setujui dulu Syarat Layanan dan Kebijakan Penggunaan Wajar versi terbaru.',
						code: 'LEGAL_ACCEPTANCE_REQUIRED'
					}
				};
			}
		});
		await page.route('**/api/v1/auth/options', (route) =>
			json(route, {
				data: { email_delivery_enabled: true, providers: { github: true, google: false }, legal }
			})
		);
		await page.route('**/api/v1/auth/user', (route) =>
			json(route, { data: { ...signedInUser, legal_acceptance_required: required } })
		);

		await page.goto(DETAIL_URL);
		await page.getByRole('button', { name: 'Redeploy' }).click();

		await expect(page.getByRole('heading', { name: 'Satu langkah lagi' })).toBeVisible();
	});
});

test.describe('deleting the account', () => {
	test('asks for the email and password, says what happens, and ends at login', async ({
		page
	}) => {
		await mockAccount(page);
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
		);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/account', (route) => {
			bodies.push(route.request().postDataJSON());
			return route.fulfill({ status: 204 });
		});

		await page.goto('/settings');
		await page.getByRole('button', { name: 'Hapus akun saya' }).click();

		const dialog = page.getByRole('dialog', { name: /Hapus akunmu/ });
		await expect(dialog).toContainText('45 hari');
		const confirm = dialog.getByRole('button', { name: 'Hapus akun saya' });
		await expect(confirm).toBeDisabled();
		await expect(dialog.getByLabel('Ketik email akunmu untuk konfirmasi')).toBeFocused();

		await dialog.getByLabel('Ketik email akunmu untuk konfirmasi').fill(signedInUser.email);
		await dialog.getByLabel('Kata sandi saat ini', { exact: true }).fill('kata-sandi');
		await confirm.click();

		await expect(page).toHaveURL(/\/login/);
		await expect(page.getByText(/Akunmu sudah dihapus/)).toBeVisible();
		expect(bodies).toEqual([{ email: signedInUser.email, current_password: 'kata-sandi' }]);
	});

	test('the admin case explains itself, even if the API has to refuse', async ({ page }) => {
		await mockAccount(page, { role: 'admin' });
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
		);

		await page.goto('/settings');

		await expect(page.getByTestId('delete-account-admin')).toContainText('Minta maintainer lain');
		await expect(page.getByRole('button', { name: 'Hapus akun saya' })).toHaveCount(0);
	});
});

test.describe('downloading my data', () => {
	const exported = {
		exported_at: '2026-11-06T00:00:00+00:00',
		max_items_per_collection: 1000,
		truncated: ['deployments'],
		account: { email: signedInUser.email },
		projects: []
	};

	test('saves the JSON and says what was cut', async ({ page }) => {
		await mockAccount(page);
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
		);
		await page.route('**/api/v1/auth/account/export', (route) => json(route, { data: exported }));

		await page.goto('/settings');
		const downloading = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Unduh data saya' }).click();
		const download = await downloading;

		expect(download.suggestedFilename()).toBe('sakala-data-export.json');
		expect(JSON.parse(readFileSync(await download.path(), 'utf8'))).toEqual(exported);
		await expect(page.getByText(/Daftar deployment hanya berisi 1000 item terbaru/)).toBeVisible();
	});

	test('a used-up export limit does not stop the rest of the console from reading', async ({
		page
	}) => {
		await mockAccount(page);
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, { data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
		);
		await page.route('**/api/v1/auth/account/export', (route) =>
			route.fulfill({
				status: 429,
				contentType: 'application/json',
				headers: { 'Retry-After': '3600' },
				body: JSON.stringify({ message: 'Too Many Attempts.' })
			})
		);

		await page.goto('/settings');
		await page.getByRole('button', { name: 'Unduh data saya' }).click();

		await expect(page.getByRole('alert')).toContainText('terlalu sering diunduh');
		expect(await page.evaluate(() => localStorage.getItem('sakala_rate_limited_until'))).toBeNull();
	});
});

test.describe('a suspended project', () => {
	const projectsUrl = `/projects/${PROJECT_ID}/deployments`;
	const suspended = (reason: string | null) => ({
		...baseProject,
		status: 'suspended',
		suspension: { reason, suspended_at: reason === null ? null : '2026-11-06T02:30:00+00:00' }
	});

	test('shows the reason on the project, and where to appeal', async ({ page }) => {
		await mockProjectApi(page, { project: () => suspended('Halaman login palsu.') });
		await page.route('**/api/v1/app/notifications?*', (route) =>
			json(route, {
				data: [
					{
						id: 'n1',
						category: 'project_issue',
						title: 'Proyek ditangguhkan',
						message:
							'toko ditangguhkan. Alasannya: Alasan lama. Kalau menurutmu keliru, kirim email.',
						project_id: PROJECT_ID,
						deployment_id: null,
						read_at: null,
						created_at: '2026-11-06T00:00:00Z'
					}
				],
				meta: { current_page: 1, last_page: 1, total: 1 }
			})
		);

		await page.goto(projectsUrl);

		await expect(page.getByTestId('suspension-reason')).toHaveText(
			'Alasannya: Halaman login palsu.'
		);
		await expect(page.getByRole('link', { name: 'abuse@sakala.dev' })).toHaveAttribute(
			'href',
			'mailto:abuse@sakala.dev'
		);
		await expect(page.getByRole('button', { name: 'Redeploy' })).toHaveCount(0);
	});

	test('shows a reason with markup as text', async ({ page }) => {
		const reason = '<img src=x onerror="window.__injected=1"> & <b>tebal</b>';
		await mockProjectApi(page, { project: () => suspended(reason) });

		await page.goto(projectsUrl);

		const line = page.getByTestId('suspension-reason');
		await expect(line).toHaveText(`Alasannya: ${reason}`);
		await expect(line.locator('img, b')).toHaveCount(0);
		expect(await page.evaluate(() => '__injected' in window)).toBe(false);
	});

	test('still names the appeal when there is no reason', async ({ page }) => {
		await mockProjectApi(page, { project: () => suspended(null) });

		await page.goto(projectsUrl);

		await expect(page.getByTestId('suspension-reason')).toContainText('notifikasi dan email');
		await expect(page.getByRole('link', { name: 'abuse@sakala.dev' })).toBeVisible();
	});

	test('says nothing about a reason once the suspension is lifted', async ({ page }) => {
		await mockProjectApi(page, { project: () => baseProject });

		await page.goto(projectsUrl);

		await expect(page.getByRole('button', { name: 'Redeploy' })).toBeVisible();
		await expect(page.getByTestId('suspension-reason')).toHaveCount(0);
	});
});
