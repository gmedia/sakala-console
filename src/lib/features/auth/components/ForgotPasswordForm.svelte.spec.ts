import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { forgotPassword, getAuthOptions } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import ForgotPasswordForm from './ForgotPasswordForm.svelte';

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

const options = (email_delivery_enabled: boolean) => ({
	email_delivery_enabled,
	providers: { github: true, google: false }
});
const renderForm = () => render(QueryTestHost, { props: { component: ForgotPasswordForm } });
const submit = () => page.getByRole('button', { name: 'Kirim Tautan Reset' });

beforeEach(() => {
	vi.mocked(forgotPassword).mockReset();
	vi.mocked(getAuthOptions).mockReset();
});

describe('ForgotPasswordForm and email delivery', () => {
	it('explains instead of asking for an email when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderForm();

		await expect
			.element(page.getByText('tautan reset kata sandi belum tersedia. Masuk lewat GitHub dulu.'))
			.toBeVisible();
		await expect.element(submit()).not.toBeInTheDocument();
	});

	it('shows the form when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderForm();

		await expect.element(submit()).toBeVisible();
	});

	it('shows no form until the flag is known', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		renderForm();

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan yang tersedia' }))
			.toBeInTheDocument();
		await expect.element(submit()).not.toBeInTheDocument();
	});

	it('shows the refusal from the API when the flag could not be fetched', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		vi.mocked(forgotPassword).mockRejectedValue(
			apiErrorFromResponse(503, {
				code: 'EMAIL_DELIVERY_UNAVAILABLE',
				apiMessage: 'Sakala belum bisa mengirim email untuk saat ini.'
			})
		);
		renderForm();

		await page.getByLabelText('Email').fill('rani@sakala.local');
		await submit().click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Sakala belum bisa mengirim email untuk saat ini.');
	});
});
