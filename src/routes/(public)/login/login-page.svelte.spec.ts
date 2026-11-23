import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getAuthOptions } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import { login } from '$lib/api/resources/auth';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { LOGIN_PASSWORD_RESET_UNAVAILABLE } from '$lib/features/auth/availability';
import { noteSessionEnded, rememberSession } from '$lib/features/auth/session-notice';
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
const emailField = () => page.getByLabelText('Email', { exact: true });
const passwordField = () => page.getByLabelText('Kata sandi', { exact: true });
const submit = () => page.getByRole('button', { name: 'Masuk', exact: true });

beforeEach(() => {
	localStorage.clear();
	vi.mocked(getAuthOptions).mockReset();
	vi.mocked(login).mockReset();
});

describe('login page and email delivery', () => {
	it('explains itself and keeps password login when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		await renderPage();

		await expect.element(page.getByText(LOGIN_PASSWORD_RESET_UNAVAILABLE)).toBeVisible();
		// Registration is the register page's business; the login page does not lead with it.
		await expect
			.element(page.getByText('Pendaftaran lewat email belum tersedia'))
			.not.toBeInTheDocument();
		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(passwordField()).toBeVisible();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('hides "Lupa kata sandi" on the password form when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		await renderPage('?method=email');

		await expect.element(page.getByText(LOGIN_PASSWORD_RESET_UNAVAILABLE)).toBeVisible();
		await expect.element(page.getByLabelText('Kata sandi', { exact: true })).toBeVisible();
		await expect.element(forgotLink()).not.toBeInTheDocument();
	});

	it('offers everything configured when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		await renderPage();

		await expect.element(provider('Google')).toBeVisible();
		await expect.element(emailField()).toBeVisible();
		await expect.element(page.getByText('belum tersedia')).not.toBeInTheDocument();
	});

	it('shows "Lupa kata sandi" when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		await renderPage('?method=email');

		await expect.element(forgotLink()).toBeVisible();
	});

	it('shows no provider until the flag is known, but the password form right away', async () => {
		let answer: (value: ReturnType<typeof options>) => void = () => {};
		vi.mocked(getAuthOptions).mockReturnValue(new Promise((resolve) => (answer = resolve)));
		await renderPage();

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' }))
			.toBeInTheDocument();
		await expect.element(provider('GitHub')).not.toBeInTheDocument();
		await expect.element(provider('Google')).not.toBeInTheDocument();
		await expect.element(passwordField()).toBeVisible();

		answer(options(false));

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).not.toBeInTheDocument();
	});

	it('does not flash the forgot link on the password form while loading', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		await renderPage('?method=email');

		await expect.element(page.getByLabelText('Kata sandi', { exact: true })).toBeVisible();
		await expect.element(forgotLink()).not.toBeInTheDocument();
	});

	it('keeps the existing options when the flag cannot be fetched', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		await renderPage();

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).toBeVisible();
		await expect.element(emailField()).toBeVisible();
	});

	it('does not offer a remembered provider that is no longer configured', async () => {
		localStorage.setItem('last_login_provider', 'google');
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		await renderPage();

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
		await renderPage('?method=email');

		await page.getByLabelText('Email', { exact: true }).fill('rani@sakala.local');
		await page.getByLabelText('Kata sandi', { exact: true }).fill('kata-sandi');
		await page.getByRole('button', { name: 'Masuk', exact: true }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('belum bisa mengirim email');
		await expect
			.element(page.getByRole('button', { name: 'Kirim ulang email verifikasi' }))
			.not.toBeInTheDocument();
	});
});

describe('every login method at once', () => {
	it('shows GitHub, Google, and the email form together, with no "Pilih cara masuk lain"', async () => {
		localStorage.setItem('last_login_provider', 'github');
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		await renderPage();

		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(provider('Google')).toBeVisible();
		await expect.element(emailField()).toBeVisible();
		await expect.element(passwordField()).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Pilih cara masuk lain' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /Masuk dengan email/ }))
			.not.toBeInTheDocument();
	});

	it('marks the provider used last and puts it first', async () => {
		localStorage.setItem('last_login_provider', 'google');
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		await renderPage();

		await expect.element(provider('Google')).toHaveTextContent('Terakhir dipakai');
		await expect.element(provider('GitHub')).not.toHaveTextContent('Terakhir dipakai');
		await expect.element(page.getByText('Terakhir dipakai')).toBeVisible();
		const order = page
			.getByRole('button', { name: /^Masuk dengan/ })
			.elements()
			.map((element) => element.textContent?.trim());
		expect(order[0]).toMatch(/^Masuk dengan Google/);
		expect(order[1]).toMatch(/^Masuk dengan GitHub/);
	});

	it('leads with the email form, badge and all, when email was used last', async () => {
		localStorage.setItem('last_login_provider', 'email');
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		await renderPage();

		await expect.element(emailField()).toBeVisible();
		const form = emailField().element().closest('form')!;
		expect(form.textContent).toContain('Terakhir dipakai');
		const formTop = form.getBoundingClientRect().top;
		const githubTop = provider('GitHub').element().getBoundingClientRect().top;
		expect(formTop).toBeLessThan(githubTop);
	});

	it('signs in with email in one step, without choosing email first', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		vi.mocked(login).mockResolvedValue(undefined as never);
		await renderPage();

		await emailField().fill('rani@sakala.local');
		await passwordField().fill('kata-sandi');
		await submit().click();

		await vi.waitFor(() =>
			expect(login).toHaveBeenCalledWith({ email: 'rani@sakala.local', password: 'kata-sandi' })
		);
	});

	it('focuses the email field for an old ?method=email link', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		await renderPage('?method=email');

		await expect.element(emailField()).toHaveFocus();
		await expect.element(provider('GitHub')).toBeVisible();
	});

	it('tabs from the method used last, through the others, into the email form', async () => {
		localStorage.setItem('last_login_provider', 'google');
		vi.mocked(getAuthOptions).mockResolvedValue(options(true, true, true));
		await renderPage();
		await expect.element(provider('Google')).toBeVisible();

		// The first stop among the methods is the one used last, and nothing sits between the
		// providers and the email form.
		const focusables = Array.from(
			document.querySelectorAll<HTMLElement>('main a[href], main button, main input')
		).map((element) => element.id || element.textContent?.trim() || '');
		expect(focusables.find((stop) => stop.startsWith('Masuk dengan'))).toMatch(
			/^Masuk dengan Google/
		);

		(provider('Google').element() as HTMLElement).focus();
		await userEvent.tab();
		await expect.element(provider('GitHub')).toHaveFocus();
		await userEvent.tab();
		await expect.element(emailField()).toHaveFocus();
		await userEvent.tab();
		await expect.element(passwordField()).toHaveFocus();
	});
});

describe('login states', () => {
	it('keeps the session-ended notice above every method', async () => {
		rememberSession();
		noteSessionEnded();
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		await renderPage();

		await expect.element(page.getByText('Sesi kamu berakhir, silakan masuk lagi.')).toBeVisible();
		await expect.element(provider('GitHub')).toBeVisible();
		await expect.element(emailField()).toBeVisible();
	});

	it('shows the rate limit the API reports, and keeps what was typed', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(login).mockRejectedValue(apiErrorFromResponse(429, { retryAfterSeconds: 60 }));
		await renderPage();

		await emailField().fill('rani@sakala.local');
		await passwordField().fill('kata-sandi');
		await submit().click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('Terlalu banyak permintaan');
		await expect.element(emailField()).toHaveValue('rani@sakala.local');
	});

	it('says a wrong password plainly', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		vi.mocked(login).mockRejectedValue(
			apiErrorFromResponse(401, { apiMessage: 'Unauthenticated.' })
		);
		await renderPage();

		await emailField().fill('rani@sakala.local');
		await passwordField().fill('salah');
		await submit().click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('Email atau kata sandi salah.');
	});

	it('shows an OAuth error from the callback above the methods', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		await renderPage('?error=github_access_denied');

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Kamu membatalkan izin masuk dengan GitHub.');
		await expect.element(emailField()).toBeVisible();
	});
});
