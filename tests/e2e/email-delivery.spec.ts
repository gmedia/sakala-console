import { expect, test, type Page, type Route } from '@playwright/test';

function reply(route: Route, status: number, body: unknown) {
	return route.fulfill({
		status,
		contentType: 'application/json',
		body: JSON.stringify(body)
	});
}

async function mockOptions(page: Page, email_delivery_enabled: boolean, google = false) {
	await page.route('**/api/v1/auth/options', (route) =>
		reply(route, 200, {
			data: { email_delivery_enabled, providers: { github: true, google } }
		})
	);
}

test.describe('email delivery is off (the state of staging and production today)', () => {
	test('a new visitor is pointed to GitHub instead of an email that never arrives', async ({
		page
	}) => {
		await mockOptions(page, false);

		await page.goto('/register');
		await expect(
			page.getByText('Pendaftaran lewat email belum tersedia. Masuk lewat GitHub dulu.')
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buat akun dengan Github' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buat akun dengan Email' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Buat akun dengan Google' })).toHaveCount(0);

		await page.goto('/register?method=email');
		await expect(page.getByRole('button', { name: 'Buat Akun', exact: true })).toHaveCount(0);
	});

	test('password login stays, without a reset link that cannot be sent', async ({ page }) => {
		await mockOptions(page, false);

		await page.goto('/login');
		await expect(page.getByText('Pendaftaran lewat email belum tersedia')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Masuk akun dengan Google' })).toHaveCount(0);

		await page.getByRole('button', { name: 'Masuk akun dengan Email' }).click();
		await expect(page.getByLabel('Kata Sandi', { exact: true })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Lupa Kata Sandi?' })).toHaveCount(0);
	});

	test('a kept forgot-password link explains itself', async ({ page }) => {
		await mockOptions(page, false);

		await page.goto('/forgot-password');

		await expect(page.getByText('tautan reset kata sandi belum tersedia')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Kirim Tautan Reset' })).toHaveCount(0);
	});

	test('an expired verification link does not offer a resend', async ({ page }) => {
		await mockOptions(page, false);

		await page.goto('/email-verified?status=error');

		await expect(page.getByText('tautan verifikasi baru belum tersedia')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Kirim ulang email verifikasi' })).toHaveCount(0);
	});
});

test.describe('email delivery is on', () => {
	test('every email option is back, with no notice', async ({ page }) => {
		await mockOptions(page, true, true);

		await page.goto('/register');
		await expect(page.getByRole('button', { name: 'Buat akun dengan Email' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buat akun dengan Google' })).toBeVisible();
		await expect(page.getByText('belum tersedia')).toHaveCount(0);

		await page.goto('/login?method=email');
		await expect(page.getByRole('link', { name: 'Lupa Kata Sandi?' })).toBeVisible();

		await page.goto('/forgot-password');
		await expect(page.getByRole('button', { name: 'Kirim Tautan Reset' })).toBeVisible();
	});
});

test.describe('the flag is not known', () => {
	test('nothing wrong flashes while it loads', async ({ page }) => {
		let answer: () => void = () => {};
		const held = new Promise<void>((resolve) => (answer = resolve));
		await page.route('**/api/v1/auth/options', async (route) => {
			await held;
			await reply(route, 200, {
				data: { email_delivery_enabled: false, providers: { github: true, google: false } }
			});
		});

		await page.goto('/register');

		await expect(
			page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' })
		).toBeVisible();
		await expect(page.getByRole('button', { name: /Buat akun dengan/ })).toHaveCount(0);

		answer();

		await expect(page.getByRole('button', { name: 'Buat akun dengan Github' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Buat akun dengan Email' })).toHaveCount(0);
	});

	test('a failed fetch keeps today’s options, and the API refusal is shown', async ({ page }) => {
		await page.route('**/api/v1/auth/options', (route) => route.abort());
		await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
		await page.route('**/api/v1/auth/forgot-password', (route) =>
			reply(route, 503, {
				code: 'EMAIL_DELIVERY_UNAVAILABLE',
				message: 'Sakala belum bisa mengirim email untuk saat ini.'
			})
		);

		await page.goto('/login');
		await expect(page.getByRole('button', { name: 'Masuk akun dengan Google' })).toBeVisible();

		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByRole('button', { name: 'Kirim Tautan Reset' }).click();

		await expect(page.getByRole('alert')).toContainText(
			'Sakala belum bisa mengirim email untuk saat ini.'
		);
	});
});
