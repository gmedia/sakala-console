import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getAuthOptions, register } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import RegisterPage from './+page.svelte';

const url = vi.hoisted(() => ({ current: new URL('http://localhost/register') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return url.current;
		}
	}
}));
vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/auth', () => ({
	changePassword: vi.fn(),
	forgotPassword: vi.fn(),
	getAuthOptions: vi.fn(),
	getCurrentUser: vi.fn(),
	login: vi.fn(),
	logout: vi.fn(),
	register: vi.fn(),
	requestEmailChange: vi.fn(),
	resendVerificationEmail: vi.fn(),
	resetPassword: vi.fn()
}));

const renderPage = (search = '') => {
	url.current = new URL(`http://localhost/register${search}`);
	return render(QueryTestHost, { props: { component: RegisterPage } });
};
const options = (email_delivery_enabled: boolean, google = false) => ({
	email_delivery_enabled,
	providers: { github: true, google }
});
const provider = (name: string) => page.getByRole('button', { name: `Buat akun dengan ${name}` });

beforeEach(() => {
	vi.mocked(getAuthOptions).mockReset();
	vi.mocked(register).mockReset();
});

describe('register page and email delivery', () => {
	it('offers only GitHub and says why when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage();

		await expect
			.element(page.getByText('Pendaftaran lewat email belum tersedia. Masuk lewat GitHub dulu.'))
			.toBeVisible();
		await expect.element(provider('Github')).toBeVisible();
		await expect.element(provider('Email')).not.toBeInTheDocument();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('does not show the form for a kept ?method=email link when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage('?method=email');

		await expect.element(provider('Github')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Buat Akun', exact: true }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Daftar', exact: true })).toBeVisible();
	});

	it('offers email when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage();

		await expect.element(provider('Email')).toBeVisible();
		await expect.element(page.getByText('belum tersedia')).not.toBeInTheDocument();
	});

	it('shows the form for ?method=email when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		await expect
			.element(page.getByRole('button', { name: 'Buat Akun', exact: true }))
			.toBeVisible();
	});

	it('shows no option and no form until the flag is known', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		renderPage('?method=email');

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Buat Akun', exact: true }))
			.not.toBeInTheDocument();
	});

	it('does not fall back to the skeleton when the resend mounts after a failed fetch', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		vi.mocked(register).mockResolvedValue(undefined);
		renderPage('?method=email');

		await page.getByLabelText('Email').fill('rani@sakala.local');
		await page.getByLabelText('Nama Lengkap').fill('Rani');
		await page.getByLabelText('Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabelText('Konfirmasi Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Buat Akun', exact: true }).click();

		await expect.element(page.getByText('Cek email kamu')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Kirim ulang email verifikasi' }))
			.toBeVisible();
		expect(getAuthOptions).toHaveBeenCalledTimes(1);
	});

	it('keeps the form on fetch failure and shows the refusal from the API', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		vi.mocked(register).mockRejectedValue(
			apiErrorFromResponse(503, {
				code: 'EMAIL_DELIVERY_UNAVAILABLE',
				apiMessage: 'Sakala belum bisa mengirim email untuk saat ini.'
			})
		);
		renderPage('?method=email');

		await page.getByLabelText('Email').fill('rani@sakala.local');
		await page.getByLabelText('Nama Lengkap').fill('Rani');
		await page.getByLabelText('Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByLabelText('Konfirmasi Kata Sandi', { exact: true }).fill('kata-sandi-baru');
		await page.getByRole('button', { name: 'Buat Akun', exact: true }).click();

		await expect
			.element(page.getByText('Sakala belum bisa mengirim email untuk saat ini.'))
			.toBeVisible();
	});
});
