import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getAuthOptions } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import { login } from '$lib/api/resources/auth';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import LoginPage from './+page.svelte';

const url = vi.hoisted(() => ({ current: new URL('http://localhost/login') }));

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
	acceptLegalDocuments: vi.fn(),
	deleteAccount: vi.fn(),
	exportAccountData: vi.fn(),
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
	url.current = new URL(`http://localhost/login${search}`);
	return render(QueryTestHost, { props: { component: LoginPage } });
};
const options = (email_delivery_enabled: boolean, github = true, google = false) => ({
	email_delivery_enabled,
	providers: { github, google },
	legal: {
		terms_version: 'syarat-v1',
		acceptable_use_version: 'penggunaan-wajar-v1',
		privacy_notice_version: 'privasi-v1'
	}
});
const provider = (name: string) => page.getByRole('button', { name: `Masuk dengan ${name}` });
const forgotLink = () => page.getByRole('link', { name: 'Lupa kata sandi?' });

beforeEach(() => {
	localStorage.clear();
	vi.mocked(getAuthOptions).mockReset();
	vi.mocked(login).mockReset();
});

describe('login page and email delivery', () => {
	it('explains itself and keeps password login when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage();

		await expect
			.element(page.getByText('Pendaftaran lewat email belum tersedia. Masuk lewat GitHub dulu.'))
			.toBeVisible();
		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('email')).toBeVisible();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('hides "Lupa kata sandi" on the password form when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage('?method=email');

		await expect.element(page.getByText('Pendaftaran lewat email belum tersedia')).toBeVisible();
		await expect.element(page.getByLabelText('Kata sandi', { exact: true })).toBeVisible();
		await expect.element(forgotLink()).not.toBeInTheDocument();
	});

	it('offers everything configured when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		renderPage();

		await expect.element(provider('Google')).toBeVisible();
		await expect.element(provider('email')).toBeVisible();
		await expect.element(page.getByText('belum tersedia')).not.toBeInTheDocument();
	});

	it('shows "Lupa kata sandi" when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderPage('?method=email');

		await expect.element(forgotLink()).toBeVisible();
	});

	it('shows no option at all until the flag is known', async () => {
		let answer: (value: ReturnType<typeof options>) => void = () => {};
		vi.mocked(getAuthOptions).mockReturnValue(new Promise((resolve) => (answer = resolve)));
		renderPage();

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' }))
			.toBeInTheDocument();
		await expect.element(provider('GitHub')).not.toBeInTheDocument();
		await expect.element(provider('Google')).not.toBeInTheDocument();
		await expect.element(provider('email')).not.toBeInTheDocument();

		answer(options(false));

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('does not flash the forgot link on the password form while loading', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		renderPage('?method=email');

		await expect.element(page.getByLabelText('Kata sandi', { exact: true })).toBeVisible();
		await expect.element(forgotLink()).not.toBeInTheDocument();
	});

	it('keeps the existing options when the flag cannot be fetched', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		renderPage();

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).toBeVisible();
		await expect.element(provider('email')).toBeVisible();
	});

	it('does not offer a remembered provider that is no longer configured', async () => {
		localStorage.setItem('last_login_provider', 'google');
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderPage();

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).not.toBeInTheDocument();
		await expect.element(page.getByText('Terakhir dipakai')).not.toBeInTheDocument();
	});

	it('hides the resend for an unverified login when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		vi.mocked(login).mockRejectedValue(
			apiErrorFromResponse(403, {
				code: 'email_not_verified',
				apiMessage: 'Email kamu belum diverifikasi, dan Sakala belum bisa mengirim email.'
			})
		);
		renderPage('?method=email');

		await page.getByLabelText('Email', { exact: true }).fill('rani@sakala.local');
		await page.getByLabelText('Kata sandi', { exact: true }).fill('kata-sandi');
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('belum bisa mengirim email');
		await expect
			.element(page.getByRole('button', { name: 'Kirim ulang email verifikasi' }))
			.not.toBeInTheDocument();
	});
});
