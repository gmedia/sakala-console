import { expect, test, type Page, type Request, type Route } from '@playwright/test';

const user = {
	id: 1,
	name: 'Rani Wulandari',
	username: 'rani',
	email: 'rani@sakala.local',
	avatar_url: null as string | null,
	role: 'user',
	onboarding_source: 'github',
	onboarding_role: 'developer',
	onboarding_completed_at: '2026-01-01T00:00:00+00:00' as string | null,
	last_login_at: '2026-01-01T00:00:00+00:00',
	has_password: true,
	pending_email: null as string | null,
	created_at: '2026-03-15T00:00:00+00:00' as string | null
};

type User = typeof user;

function reply(route: Route, status: number, body?: unknown, headers?: Record<string, string>) {
	if (status === 204) return route.fulfill({ status });
	return route.fulfill({
		status,
		headers,
		contentType: 'application/json',
		body: JSON.stringify(body ?? {})
	});
}

function emptyPage() {
	return { data: [], meta: { current_page: 1, last_page: 1, total: 0 } };
}

const rateLimitHeaders = {
	'Retry-After': '42',
	'Access-Control-Expose-Headers': 'Retry-After'
};

async function mockCsrf(page: Page) {
	await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
}

/** A signed-in user. Each test adds or overrides the endpoints it is about. */
async function mockSession(page: Page, overrides: Partial<User> = {}) {
	await mockCsrf(page);
	await page.route('**/api/v1/auth/user', (route) =>
		reply(route, 200, { data: { ...user, ...overrides } })
	);
	await page.route('**/api/v1/app/notifications/unread-count', (route) =>
		reply(route, 200, { data: { count: 0 } })
	);
	await page.route('**/api/v1/app/notifications?*', (route) => reply(route, 200, emptyPage()));
	await page.route('**/api/v1/app/github/installations', (route) =>
		reply(route, 200, { data: [] })
	);
}

async function mockSignedOut(page: Page) {
	await mockCsrf(page);
	await page.route('**/api/v1/auth/user', (route) =>
		reply(route, 401, { message: 'Unauthenticated.' })
	);
}

test.describe('GitHub installation (U-05, U-52)', () => {
	test('"Hubungkan GitHub" leaves for the API origin', async ({ page }) => {
		await mockSession(page);
		const requests: Request[] = [];
		await page.route('**/auth/github/install', (route) => {
			requests.push(route.request());
			return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>GitHub</p>' });
		});

		await page.goto('/projects/new');
		await page.getByRole('button', { name: 'Hubungkan GitHub' }).click();

		await expect.poll(() => requests.length).toBe(1);
		expect(new URL(requests[0].url()).origin).not.toBe('http://127.0.0.1:4173');
	});

	test('coming back connected says so, and cleans the address', async ({ page }) => {
		await mockSession(page);

		await page.goto('/projects/new?github_installation=connected');

		await expect(page.getByRole('status').getByText('GitHub sudah terhubung')).toBeVisible();
		await expect(page).toHaveURL('/projects/new');
		await expect(page.getByRole('heading', { name: 'Proyek Baru', exact: true })).toBeVisible();
	});

	test('coming back with an error explains it on the wizard', async ({ page }) => {
		await mockSession(page);

		await page.goto('/projects/new?github_installation=error&error=github_invalid_installation');

		await expect(page.getByRole('alert').first()).toContainText('pemilik organisasi');
		await expect(page).toHaveURL('/projects/new');
		await expect(page.getByText('Pilih repository', { exact: true })).toBeVisible();
	});
});

test.describe('landing pages from email links (U-06)', () => {
	test('a verified email is confirmed, with a way to log in', async ({ page }) => {
		await page.goto('/email-verified?status=success');

		await expect(page.getByRole('heading', { name: 'Verifikasi Email Berhasil' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Masuk' })).toHaveAttribute('href', '/login');
	});

	test('a bad link says so and offers a new one', async ({ page }) => {
		await mockCsrf(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/email/verification-notification', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 202, { data: { request_accepted: true } });
		});

		await page.goto('/email-verified?status=error');

		await expect(
			page.getByRole('heading', { name: 'Tautan Verifikasi Tidak Berlaku' })
		).toBeVisible();
		await page.getByLabel('Email akunmu').fill('rani@sakala.local');
		await page.getByRole('button', { name: 'Kirim ulang email verifikasi' }).click();

		await expect(page.getByRole('status')).toContainText('rani@sakala.local');
		expect(bodies).toEqual([{ email: 'rani@sakala.local' }]);
	});

	for (const url of ['/email-verified', '/email-verified?status=hacked']) {
		test(`${url} claims neither success nor failure`, async ({ page }) => {
			await page.goto(url);

			await expect(
				page.getByRole('heading', { name: 'Status Verifikasi Tidak Diketahui' })
			).toBeVisible();
			await expect(page.getByText('Verifikasi Email Berhasil')).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Masuk' })).toBeVisible();
		});
	}

	test('the email-change link lands on its own page', async ({ page }) => {
		await page.goto('/email-changed?status=success');
		await expect(page.getByRole('heading', { name: 'Email Berhasil Diganti' })).toBeVisible();

		await page.goto('/email-changed?status=error');
		await expect(
			page.getByRole('heading', { name: 'Tautan Ganti Email Tidak Berlaku' })
		).toBeVisible();

		await page.goto('/email-changed');
		await expect(
			page.getByRole('heading', { name: 'Status Ganti Email Tidak Diketahui' })
		).toBeVisible();
	});
});

test.describe('error page (U-06)', () => {
	test('an unknown address gets a branded 404 with ways onward', async ({ page }) => {
		await page.goto('/alamat/yang/tidak/ada');

		await expect(
			page.getByRole('heading', { level: 1, name: 'Halaman tidak ditemukan' })
		).toBeVisible();
		await expect(page.getByText('Error 404')).toBeVisible();
		await expect(page.getByRole('link', { name: 'Buka Proyek' })).toHaveAttribute(
			'href',
			'/projects'
		);
		await expect(page.getByRole('link', { name: 'Ke Halaman Masuk' })).toHaveAttribute(
			'href',
			'/login'
		);
		await expect(page.locator('body')).not.toContainText('Not Found');
	});

	test('the simulated Google verification page is gone (U-65)', async ({ page }) => {
		await page.goto('/login/verify/google');

		await expect(page.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeVisible();
	});
});

test.describe('unverified login and resend (U-32)', () => {
	const unverified = {
		code: 'email_not_verified',
		message: 'Email kamu belum diverifikasi. Buka tautan verifikasi yang kami kirim ke email kamu.'
	};

	async function failLoginUnverified(page: Page) {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/login', (route) => reply(route, 403, unverified));
		await page.goto('/login?method=email');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('kata-sandi-benar');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();
	}

	test('shows the real reason and a resend, for the address just typed', async ({ page }) => {
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/email/verification-notification', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 202, { data: { request_accepted: true } });
		});

		await failLoginUnverified(page);

		await expect(page.getByRole('alert')).toContainText('belum diverifikasi');
		await expect(page.getByText('Email atau kata sandi salah')).toHaveCount(0);

		await page.getByRole('button', { name: 'Kirim ulang email verifikasi' }).click();

		await expect(page.getByRole('status')).toContainText('rani@sakala.local');
		expect(bodies).toEqual([{ email: 'rani@sakala.local' }]);
		// The button pauses after a send, so a second click cannot burn the limit.
		await expect(page.getByRole('button', { name: /Kirim ulang dalam \d+ detik/ })).toBeDisabled();
	});

	test('says when the resend limit is hit, and for how long', async ({ page }) => {
		await page.route('**/api/v1/auth/email/verification-notification', (route) =>
			reply(route, 429, { message: 'Too Many Attempts.' }, rateLimitHeaders)
		);

		await failLoginUnverified(page);
		await page.getByRole('button', { name: 'Kirim ulang email verifikasi' }).click();

		await expect(page.getByText('Coba lagi dalam 42 detik.')).toBeVisible();
		await expect(page.getByRole('button', { name: /Kirim ulang dalam 4\d detik/ })).toBeDisabled();
	});

	test('a wrong password does not offer a resend', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/login', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);

		await page.goto('/login?method=email');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('salah');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
		await expect(page.getByRole('button', { name: /Kirim ulang/ })).toHaveCount(0);
	});

	test('the post-register screen can resend too', async ({ page }) => {
		await mockCsrf(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/register', (route) =>
			reply(route, 202, {
				data: { name: 'Rani', email: 'rani@sakala.local', verification_required: true }
			})
		);
		await page.route('**/api/v1/auth/email/verification-notification', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 202, { data: { request_accepted: true } });
		});

		await page.goto('/register?method=email');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Nama Lengkap').fill('Rani');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Buat Akun' }).click();

		// The API answers the same for a new and an existing email, so the screen cannot say which.
		await expect(page.getByText('Cek email kamu')).toBeVisible();
		await expect(page.getByRole('status')).toContainText('Langkah berikutnya kami kirim ke');
		await expect(page.locator('main')).not.toContainText('sudah dibuat');
		await page.getByRole('button', { name: 'Kirim ulang email verifikasi' }).click();

		await expect.poll(() => bodies).toEqual([{ email: 'rani@sakala.local' }]);
	});
});

test.describe('login form accessibility (U-91)', () => {
	test('empty fields are flagged, described, and focused', async ({ page }) => {
		await page.goto('/login?method=email');

		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		const email = page.getByLabel('Email');
		await expect(email).toBeFocused();
		await expect(email).toHaveAttribute('aria-invalid', 'true');
		await expect(email).toHaveAccessibleDescription('Kamu belum memasukkan email.');
	});

	test('a refused login announces the error and moves focus to it', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/login', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);

		await page.goto('/login?method=email');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('salah');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		await expect(page.getByRole('alert')).toBeFocused();
	});
});

test.describe('forgot and reset password (U-33)', () => {
	test('the login page links to it', async ({ page }) => {
		await page.goto('/login?method=email');

		await expect(page.getByRole('link', { name: 'Lupa Kata Sandi?' })).toHaveAttribute(
			'href',
			'/forgot-password'
		);
	});

	test('the answer does not reveal whether the email is registered', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/forgot-password', (route) =>
			reply(route, 202, { data: { request_accepted: true } })
		);

		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill('siapa@contoh.com');
		await page.getByRole('button', { name: 'Kirim Tautan Reset' }).click();

		await expect(page.getByRole('status')).toContainText('Kalau siapa@contoh.com terdaftar');
	});

	test('says when the limit is hit', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/forgot-password', (route) =>
			reply(route, 429, { message: 'Too Many Attempts.' }, rateLimitHeaders)
		);

		await page.goto('/forgot-password');
		await page.getByLabel('Email').fill('siapa@contoh.com');
		await page.getByRole('button', { name: 'Kirim Tautan Reset' }).click();

		await expect(page.getByRole('alert')).toContainText('Coba lagi dalam 42 detik');
	});

	test('reset reads the token, takes it off the address bar, and sends it in the body', async ({
		page
	}) => {
		await mockCsrf(page);
		const consoleLines: string[] = [];
		page.on('console', (message) => consoleLines.push(message.text()));
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/reset-password', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 204);
		});

		await page.goto('/reset-password?token=rahasia-123&email=rani%40sakala.local');

		await expect(page).toHaveURL('/reset-password');
		await expect(page.getByLabel('Email')).toHaveValue('rani@sakala.local');
		expect(await page.evaluate(() => history.state && JSON.stringify(history.state))).not.toContain(
			'rahasia-123'
		);

		await page.getByLabel('Kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Simpan Kata Sandi' }).click();

		await expect(page.getByText('Kata sandi sudah diganti')).toBeVisible();
		expect(bodies).toEqual([
			{
				token: 'rahasia-123',
				email: 'rani@sakala.local',
				password: 'kata-sandi-baru',
				password_confirmation: 'kata-sandi-baru'
			}
		]);
		expect(consoleLines.join('\n')).not.toContain('rahasia-123');
	});

	test('a refused token points to a new link', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/reset-password', (route) =>
			reply(route, 422, {
				code: 'invalid_reset_token',
				message: 'Tautan reset kata sandi ini sudah tidak berlaku.'
			})
		);

		await page.goto('/reset-password?token=lama&email=rani%40sakala.local');
		await page.getByLabel('Kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Simpan Kata Sandi' }).click();

		await expect(page.getByRole('alert')).toContainText('sudah tidak berlaku');
		await expect(page.getByRole('link', { name: 'Minta tautan baru' })).toHaveAttribute(
			'href',
			'/forgot-password'
		);
	});

	test('without a token it asks for a new link instead of showing a form', async ({ page }) => {
		await page.goto('/reset-password');

		await expect(page.getByRole('link', { name: 'Minta tautan baru' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Simpan Kata Sandi' })).toHaveCount(0);
	});
});

test.describe('account settings (U-07)', () => {
	test('asks for an email change and shows it as pending, not as done', async ({ page }) => {
		await mockSession(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/email/change', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 202, { data: { ...user, pending_email: 'baru@sakala.local' } });
		});

		await page.goto('/settings');
		await page.getByLabel('Email baru').fill('baru@sakala.local');
		await page.getByRole('textbox', { name: 'Kata sandi saat ini' }).fill('kata-sandi');
		await page.getByRole('button', { name: 'Ubah Email' }).click();

		await expect(page.getByText('Cek email baru')).toBeVisible();
		await expect(page.getByText(/Email saat ini:\s*rani@sakala\.local/)).toBeVisible();
		expect(bodies).toEqual([{ email: 'baru@sakala.local', current_password: 'kata-sandi' }]);
	});

	test('a pending address from the API is shown on load', async ({ page }) => {
		await mockSession(page, { pending_email: 'baru@sakala.local' });

		await page.goto('/settings');

		await expect(page.getByRole('status')).toContainText('baru@sakala.local');
	});

	test('a wrong password on email change shows on that field', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/auth/email/change', (route) =>
			reply(route, 422, {
				message: 'Kata sandi salah.',
				errors: {
					current_password: ['Kata sandi salah. Masukkan kata sandi yang sedang kamu pakai.']
				}
			})
		);

		await page.goto('/settings');
		await page.getByLabel('Email baru').fill('baru@sakala.local');
		const password = page.getByRole('textbox', { name: 'Kata sandi saat ini' });
		await password.fill('salah');
		await page.getByRole('button', { name: 'Ubah Email' }).click();

		await expect(password).toHaveAttribute('aria-invalid', 'true');
		await expect(password).toHaveAccessibleDescription(/Kata sandi salah/);
		await expect(password).toBeFocused();
	});

	test('the password card starts collapsed and changes the password for real', async ({ page }) => {
		await mockSession(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/password', (route) => {
			expect(route.request().method()).toBe('PUT');
			bodies.push(route.request().postDataJSON());
			return reply(route, 200, { data: user });
		});

		await page.goto('/settings');

		await expect(page.getByLabel('Kata sandi baru', { exact: true })).toHaveCount(0);
		await page.getByRole('button', { name: 'Ubah', exact: true }).click();

		await page.locator('#current-password').fill('lama-sekali');
		await page.getByLabel('Kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Perbarui Kata Sandi' }).click();

		await expect(page.getByText('Kata sandi sudah diganti')).toBeVisible();
		expect(bodies).toEqual([
			{
				current_password: 'lama-sekali',
				password: 'kata-sandi-baru',
				password_confirmation: 'kata-sandi-baru'
			}
		]);
	});

	test('a wrong current password does not read as saved', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/auth/password', (route) =>
			reply(route, 422, {
				message: 'Kata sandi salah.',
				errors: {
					current_password: ['Kata sandi salah. Masukkan kata sandi yang sedang kamu pakai.']
				}
			})
		);

		await page.goto('/settings');
		await page.getByRole('button', { name: 'Ubah', exact: true }).click();
		const current = page.locator('#current-password');
		await current.fill('salah');
		await page.getByLabel('Kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Perbarui Kata Sandi' }).click();

		await expect(current).toHaveAttribute('aria-invalid', 'true');
		await expect(current).toBeFocused();
		await expect(page.getByText('Kata sandi sudah diganti')).toHaveCount(0);
	});

	test('an OAuth account sets its first password without a current one', async ({ page }) => {
		await mockSession(page, { has_password: false });
		const bodies: unknown[] = [];
		await page.route('**/api/v1/auth/password', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 200, { data: { ...user, has_password: true } });
		});

		await page.goto('/settings');

		// Changing the email needs a password to confirm with, so it waits for this one.
		await expect(page.getByRole('button', { name: 'Ubah Email' })).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Buat Kata Sandi' })).toBeVisible();

		await page.getByRole('button', { name: 'Buat', exact: true }).click();
		await expect(page.locator('#current-password')).toHaveCount(0);
		await page.getByLabel('Kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabel('Konfirmasi kata sandi baru', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Buat Kata Sandi' }).click();

		await expect(page.getByText('Kata sandi sudah dibuat')).toBeVisible();
		expect(bodies).toEqual([
			{ password: 'kata-sandi-baru', password_confirmation: 'kata-sandi-baru' }
		]);
		await expect(page.getByRole('button', { name: 'Ubah Email' })).toBeVisible();
	});

	test('does not claim rules or features the API lacks', async ({ page }) => {
		await mockSession(page);

		await page.goto('/settings');

		await expect(page.locator('main')).not.toContainText('akses API');
		await expect(page.locator('main')).not.toContainText('kata sandi sementara');
		await page.getByRole('button', { name: 'Ubah', exact: true }).click();
		await expect(page.getByText('Minimal 8 karakter.')).toBeVisible();
		await expect(page.locator('main')).not.toContainText('simbol');
	});
});

test.describe('profile (U-08, U-61)', () => {
	test('saves name and username through the API and updates the sidebar', async ({ page }) => {
		await mockSession(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/app/profile', (route) => {
			expect(route.request().method()).toBe('PATCH');
			bodies.push(route.request().postDataJSON());
			return reply(route, 200, { data: { ...user, name: 'Rani W', username: 'rani-w' } });
		});

		await page.goto('/profile');
		await page.getByLabel('Nama lengkap').fill('Rani W');
		await page.getByLabel('Username').fill('rani-w');
		await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

		await expect(page.getByText('Profil tersimpan.')).toBeVisible();
		await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Menu akun pengguna' })).toContainText('Rani W');
		expect(bodies).toEqual([{ name: 'Rani W', username: 'rani-w' }]);
	});

	test('sends only what changed', async ({ page }) => {
		await mockSession(page);
		const bodies: unknown[] = [];
		await page.route('**/api/v1/app/profile', (route) => {
			bodies.push(route.request().postDataJSON());
			return reply(route, 200, { data: { ...user, name: 'Rani W' } });
		});

		await page.goto('/profile');
		await page.getByLabel('Nama lengkap').fill('Rani W');
		await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

		await expect(page.getByText('Profil tersimpan.')).toBeVisible();
		expect(bodies).toEqual([{ name: 'Rani W' }]);
	});

	test('a failed save does not read as saved, and a taken username shows on its field', async ({
		page
	}) => {
		await mockSession(page);
		await page.route('**/api/v1/app/profile', (route) =>
			reply(route, 422, {
				message: 'Username sudah dipakai.',
				errors: { username: ['Username sudah dipakai.'] }
			})
		);

		await page.goto('/profile');
		const username = page.getByLabel('Username');
		await username.fill('dipakai');
		await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

		await expect(username).toHaveAttribute('aria-invalid', 'true');
		await expect(username).toHaveAccessibleDescription('Username sudah dipakai.');
		await expect(page.getByText('Profil tersimpan.')).toHaveCount(0);
	});

	test('username rules come from the API and block the save', async ({ page }) => {
		await mockSession(page);

		await page.goto('/profile');
		await page.getByLabel('Username').fill('Rani_W');

		await expect(page.getByLabel('Username')).toHaveAttribute('aria-invalid', 'true');
		await expect(page.getByRole('button', { name: 'Simpan Perubahan' })).toBeDisabled();
	});

	test('shows when the account was created', async ({ page }) => {
		await mockSession(page);

		await page.goto('/profile');

		await expect(page.getByLabel('Bergabung sejak')).toHaveValue('15 Maret 2026');
	});

	test('the photo dialog traps focus, closes on Esc, and gives focus back (U-69)', async ({
		page
	}) => {
		await mockSession(page);
		await page.goto('/profile');

		const trigger = page.getByRole('button', { name: 'Edit Foto' });
		await trigger.click();
		const dialog = page.getByRole('dialog', { name: 'Ubah Foto Profil' });
		await expect(dialog.getByRole('button', { name: 'Unggah Foto' })).toBeFocused();

		for (let i = 0; i < 4; i++) {
			await page.keyboard.press('Tab');
			expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
		}

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});

	test('uploads a new photo as multipart POST with _method PATCH', async ({ page }) => {
		await mockSession(page);
		const uploads: { method: string; contentType: string; body: string }[] = [];
		await page.route('**/api/v1/app/profile', (route) => {
			const request = route.request();
			uploads.push({
				method: request.method(),
				contentType: request.headers()['content-type'] ?? '',
				body: request.postData() ?? ''
			});
			return reply(route, 200, {
				data: { ...user, avatar_url: 'https://cdn.sakala.local/avatars/baru.png' }
			});
		});
		await page.route('https://cdn.sakala.local/**', (route) =>
			route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('') })
		);

		await page.goto('/profile');
		await page.getByRole('button', { name: 'Edit Foto' }).click();
		await page.getByLabel('Pilih foto profil').setInputFiles({
			name: 'foto.png',
			mimeType: 'image/png',
			buffer: Buffer.from('png')
		});

		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(uploads).toHaveLength(1);
		expect(uploads[0].method).toBe('POST');
		expect(uploads[0].contentType).toContain('multipart/form-data');
		expect(uploads[0].body).toContain('name="_method"');
		expect(uploads[0].body).toContain('name="avatar"');
		await expect(
			page.getByRole('img', { name: 'Foto profil Rani Wulandari' }).first()
		).toHaveAttribute('src', 'https://cdn.sakala.local/avatars/baru.png');
	});

	test('an oversized photo is refused before any upload', async ({ page }) => {
		await mockSession(page);
		let uploaded = false;
		await page.route('**/api/v1/app/profile', (route) => {
			uploaded = true;
			return reply(route, 200, { data: user });
		});

		await page.goto('/profile');
		await page.getByRole('button', { name: 'Edit Foto' }).click();
		await page.getByLabel('Pilih foto profil').setInputFiles({
			name: 'besar.png',
			mimeType: 'image/png',
			buffer: Buffer.alloc(1024 * 1024 + 1)
		});

		await expect(page.getByRole('alert')).toContainText('Maksimal ukuran foto adalah 1 MB');
		expect(uploaded).toBe(false);
	});

	test('removes the photo with DELETE, and only offers that when there is one', async ({
		page
	}) => {
		const avatar = 'https://cdn.sakala.local/avatars/lama.png';
		await mockSession(page, { avatar_url: avatar });
		await page.route('https://cdn.sakala.local/**', (route) =>
			route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('') })
		);
		const methods: string[] = [];
		await page.route('**/api/v1/app/profile/avatar', (route) => {
			methods.push(route.request().method());
			return reply(route, 200, { data: { ...user, avatar_url: null } });
		});

		await page.goto('/profile');
		await page.getByRole('button', { name: 'Edit Foto' }).click();
		await page.getByRole('button', { name: 'Hapus Foto Saat Ini' }).click();

		await expect(page.getByRole('dialog')).toHaveCount(0);
		expect(methods).toEqual(['DELETE']);

		await page.getByRole('button', { name: 'Edit Foto' }).click();
		await expect(page.getByRole('button', { name: 'Hapus Foto Saat Ini' })).toHaveCount(0);
	});
});

test.describe('notifications (U-09, U-10, U-56)', () => {
	const notification = {
		id: '0198c5e0-7c1d-7000-8000-000000000001',
		category: 'deployment_failure',
		title: 'Deployment gagal',
		message: 'Build sakala-console gagal.',
		project_id: null,
		deployment_id: null,
		read_at: null as string | null,
		created_at: '2026-10-01T00:00:00+00:00'
	};

	test('no sample data for a new user: the bell is clean and the list is empty', async ({
		page
	}) => {
		await mockSession(page);

		await page.goto('/notifications');

		await expect(page.getByText('Tidak Ada Notifikasi')).toBeVisible();
		await expect(page.getByTestId('bell-unread-dot')).toHaveCount(0);
		await expect(page.locator('body')).not.toContainText('E-Commerce Platform');
	});

	test('the bell dot follows the count, and polling picks up a new one without realtime', async ({
		page
	}) => {
		await page.clock.install();
		await mockSession(page);
		let count = 0;
		await page.route('**/api/v1/app/notifications/unread-count', (route) =>
			reply(route, 200, { data: { count } })
		);

		await page.goto('/settings');
		await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible();
		await expect(page.getByTestId('bell-unread-dot')).toHaveCount(0);

		count = 2;
		await page.clock.fastForward(61_000);

		await expect(page.getByTestId('bell-unread-dot')).toBeVisible();
		await expect(
			page.getByRole('button', { name: 'Buka notifikasi, 2 belum dibaca' })
		).toBeVisible();
	});

	test('marking one as read reaches the API and clears the dot', async ({ page }) => {
		await mockSession(page);
		let read = false;
		const paths: string[] = [];
		await page.route('**/api/v1/app/notifications?*', (route) =>
			reply(route, 200, {
				data: [{ ...notification, read_at: read ? '2026-10-02T00:00:00+00:00' : null }],
				meta: { current_page: 1, last_page: 1, total: 1 }
			})
		);
		await page.route('**/api/v1/app/notifications/unread-count', (route) =>
			reply(route, 200, { data: { count: read ? 0 : 1 } })
		);
		await page.route('**/api/v1/app/notifications/*/read', (route) => {
			paths.push(new URL(route.request().url()).pathname);
			read = true;
			return reply(route, 200, { data: { ...notification, read_at: '2026-10-02T00:00:00+00:00' } });
		});

		await page.goto('/notifications');
		await expect(page.getByTestId('bell-unread-dot')).toBeVisible();

		await page.getByText('Build sakala-console gagal.').click();

		await expect(page.getByTestId('bell-unread-dot')).toHaveCount(0);
		await expect(page.getByTestId('unread-dot')).toHaveCount(0);
		expect(paths).toEqual([`/api/v1/app/notifications/${notification.id}/read`]);
	});

	test('marking all as read reaches the API and clears the dot', async ({ page }) => {
		await mockSession(page);
		let read = false;
		let calls = 0;
		await page.route('**/api/v1/app/notifications?*', (route) =>
			reply(route, 200, {
				data: [{ ...notification, read_at: read ? '2026-10-02T00:00:00+00:00' : null }],
				meta: { current_page: 1, last_page: 1, total: 1 }
			})
		);
		await page.route('**/api/v1/app/notifications/unread-count', (route) =>
			reply(route, 200, { data: { count: read ? 0 : 1 } })
		);
		await page.route('**/api/v1/app/notifications/read-all', (route) => {
			calls += 1;
			read = true;
			return reply(route, 204);
		});

		await page.goto('/notifications');
		await page.getByRole('button', { name: 'Tandai semua telah dibaca' }).click();

		await expect(page.getByTestId('bell-unread-dot')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Tandai semua telah dibaca' })).toBeDisabled();
		expect(calls).toBe(1);
	});

	test('preferences survive a reload because they live on the API', async ({ page }) => {
		await mockSession(page);
		const saved = {
			deployment_success: true,
			deployment_failure: true,
			project_issue: true,
			account_security: true
		};
		const bodies: unknown[] = [];
		await page.route('**/api/v1/app/notification-preferences', (route) => {
			if (route.request().method() === 'PATCH') {
				const changes = route.request().postDataJSON();
				bodies.push(changes);
				Object.assign(saved, changes);
			}
			return reply(route, 200, { data: saved });
		});

		await page.goto('/settings?tab=notifications');
		await page.getByRole('switch', { name: 'Deployment Berhasil' }).click();
		await page.getByRole('button', { name: 'Simpan Perubahan' }).click();
		await expect(page.getByText('Pengaturan notifikasi tersimpan.')).toBeVisible();

		await page.reload();

		await expect(page.getByRole('switch', { name: 'Deployment Berhasil' })).toHaveAttribute(
			'aria-checked',
			'false'
		);
		expect(bodies).toEqual([{ deployment_success: false }]);
	});
});

test.describe('a session that ends mid-way (U-30)', () => {
	test('a 401 on any query goes to login with the way back', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/app/notifications?*', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);

		await page.goto('/notifications');

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fnotifications$/);
	});

	test('a 401 on a polling request does too, with no navigation by the user', async ({ page }) => {
		await page.clock.install();
		await mockSession(page);
		let expired = false;
		await page.route('**/api/v1/app/notifications/unread-count', (route) =>
			expired
				? reply(route, 401, { message: 'Unauthenticated.' })
				: reply(route, 200, { data: { count: 0 } })
		);

		await page.goto('/settings?tab=account');
		await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible();

		expired = true;
		await page.clock.fastForward(61_000);

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fsettings%3Ftab%3Daccount$/);
	});

	test('says the session ended, and returns to the same page after logging in', async ({
		page
	}) => {
		await page.clock.install();
		await mockSession(page);
		let expired = false;
		await page.route('**/api/v1/app/notifications/unread-count', (route) =>
			expired
				? reply(route, 401, { message: 'Unauthenticated.' })
				: reply(route, 200, { data: { count: 0 } })
		);
		await page.route('**/api/v1/auth/login', (route) => {
			expired = false;
			return reply(route, 200, { data: user });
		});

		await page.goto('/settings?tab=account');
		await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible();

		expired = true;
		await page.clock.fastForward(61_000);

		await expect(page.getByRole('status')).toHaveText('Sesi kamu berakhir, silakan masuk lagi.');

		await page.getByRole('button', { name: /dengan Email/ }).click();
		await expect(page.getByRole('status')).toHaveText('Sesi kamu berakhir, silakan masuk lagi.');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('kata-sandi-benar');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		await expect(page).toHaveURL('/settings?tab=account');
	});

	test('coming back with an expired cookie gets the same explanation', async ({ page }) => {
		await mockSession(page);
		await page.goto('/settings');
		await expect(page.getByRole('heading', { name: 'Pengaturan', exact: true })).toBeVisible();

		await page.route('**/api/v1/auth/user', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);
		await page.goto('/profile');

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
		await expect(page.getByText('Sesi kamu berakhir, silakan masuk lagi.')).toBeVisible();
	});

	test('someone who never logged in is not told a session ended', async ({ page }) => {
		await mockSignedOut(page);

		await page.goto('/profile');

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
		await expect(page.getByRole('heading', { name: 'Selamat Datang' })).toBeVisible();
		await expect(page.getByText('Sesi kamu berakhir')).toHaveCount(0);
	});

	test('a 401 on a mutation goes to login too', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/app/profile', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);

		await page.goto('/profile');
		await page.getByLabel('Nama lengkap').fill('Rani W');
		await page.getByRole('button', { name: 'Simpan Perubahan' }).click();

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fprofile$/);
	});

	test('nothing from the old session survives for whoever logs in next', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/app/notifications?*', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);
		await page.goto('/notifications');
		await expect(page).toHaveURL(/\/login/);

		const other = { ...user, id: 2, name: 'Pengguna Lain', email: 'lain@sakala.local' };
		await page.route('**/api/v1/auth/user', (route) => reply(route, 200, { data: other }));
		await page.route('**/api/v1/auth/login', (route) => reply(route, 200, { data: other }));
		await page.route('**/api/v1/app/notifications?*', (route) => reply(route, 200, emptyPage()));

		await page.getByRole('button', { name: 'Masuk akun dengan Email' }).click();
		await page.getByLabel('Email').fill('lain@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('kata-sandi');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		await expect(page).toHaveURL('/notifications');
		await expect(page.getByRole('button', { name: 'Menu akun pengguna' })).toContainText(
			'Pengguna Lain'
		);
	});

	for (const status of [403, 500]) {
		test(`a ${status} on a query stays on the page`, async ({ page }) => {
			await mockSession(page);
			await page.route('**/api/v1/app/notifications?*', (route) => reply(route, status, {}));

			await page.goto('/notifications');

			await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible({
				timeout: 15_000
			});
			await expect(page).toHaveURL('/notifications');
		});
	}

	test('a wrong password on the login form is not treated as an expired session', async ({
		page
	}) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/login', (route) =>
			reply(route, 401, { message: 'Unauthenticated.' })
		);

		await page.goto('/login?method=email&returnTo=%2Fprofile');
		await page.getByLabel('Email').fill('rani@sakala.local');
		await page.getByLabel('Kata Sandi', { exact: true }).fill('salah');
		await page.getByRole('button', { name: 'Lanjutkan dengan Email' }).click();

		await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
		expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/profile');
	});
});

test.describe('onboarding (U-84, U-66)', () => {
	test('requires a session', async ({ page }) => {
		await mockSignedOut(page);

		await page.goto('/onboarding');

		await expect(page).toHaveURL(/\/login\?returnTo=%2Fonboarding$/);
	});

	test('is skipped by someone who already finished it', async ({ page }) => {
		await mockSession(page);
		await page.route('**/api/v1/app/projects?*', (route) =>
			reply(route, 200, { data: [], links: {}, meta: { total: 0 } })
		);

		await page.goto('/onboarding');

		await expect(page).toHaveURL('/projects');
	});

	test('shows the steps to someone who has not', async ({ page }) => {
		await mockSession(page, { onboarding_completed_at: null });

		await page.goto('/onboarding');

		await expect(page).toHaveURL('/onboarding');
		await expect(page.getByText('Langkah 1 dari 3')).toBeVisible();
	});

	for (const [label, role] of [
		['Mahasiswa', 'student'],
		['Mentor', 'mentor']
	]) {
		test(`${label} is offered and saved as ${role}`, async ({ page }) => {
			await mockSession(page, { onboarding_completed_at: null });
			const bodies: unknown[] = [];
			await page.route('**/api/v1/onboarding/source', (route) =>
				reply(route, 200, { data: { ...user, onboarding_completed_at: null } })
			);
			await page.route('**/api/v1/onboarding/profile', (route) => {
				bodies.push(route.request().postDataJSON());
				return reply(route, 200, {
					data: { ...user, onboarding_completed_at: null, onboarding_role: role }
				});
			});

			await page.goto('/onboarding');
			await page.getByRole('button', { name: 'Lewati' }).click();
			await page.getByLabel('Nama Tampilan').fill('Rani');
			await page.getByRole('radio', { name: label, exact: true }).check({ force: true });
			await page.getByRole('button', { name: 'Lanjutkan' }).click();

			await expect(page.getByText('Langkah 3 dari 3')).toBeVisible();
			expect(bodies).toEqual([{ name: 'Rani', role }]);
		});
	}
});

test.describe('honest copy', () => {
	test('the 500 page does not claim the team was notified (U-12)', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/user', (route) => reply(route, 500, {}));

		await page.goto('/projects');

		await expect(page.getByText('Server sedang bermasalah')).toBeVisible({ timeout: 15_000 });
		await expect(page.locator('body')).not.toContainText('diberi tahu');
	});

	test('loading shows no invented percentage (U-99)', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/user', () => {
			// Never answers: the guard stays in its loading state.
		});

		await page.goto('/projects');

		await expect(page.getByText('Mohon tunggu')).toBeVisible();
		await expect(page.locator('body')).not.toContainText('%');
		await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
	});

	test('a 403 from the guard has a way out (U-99)', async ({ page }) => {
		await mockCsrf(page);
		await page.route('**/api/v1/auth/user', (route) => reply(route, 403, {}));

		await page.goto('/projects');

		await expect(page.getByText('Kamu tidak memiliki akses')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByRole('button', { name: 'Coba lagi' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Masuk dengan akun lain' })).toHaveAttribute(
			'href',
			'/login'
		);
	});

	test('register does not promise legal pages that do not exist', async ({ page }) => {
		await page.goto('/register');

		const main = page.locator('main');
		await expect(main).toContainText('belum memiliki Ketentuan Layanan');
		await expect(main).not.toContainText('Dengan mendaftar');
		await expect(main).not.toContainText('menyetujui');
	});

	test('register states the password rule the API actually has', async ({ page }) => {
		await page.goto('/register?method=email');

		await expect(page.getByText('Minimal 8 karakter.')).toBeVisible();
		await expect(page.locator('main')).not.toContainText('simbol');
	});
});
