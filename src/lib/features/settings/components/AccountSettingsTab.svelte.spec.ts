import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { getAuthOptions, getCurrentUser, requestEmailChange } from '$lib/api/resources/auth';
import { apiErrorFromResponse } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import AccountSettingsTab from './AccountSettingsTab.svelte';

vi.mock('$lib/api/resources/pilot-limits', () => ({
	getPilotLimits: vi.fn(() => new Promise(() => {}))
}));
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
	acceptLegalDocuments: vi.fn(),
	deleteAccount: vi.fn(),
	exportAccountData: vi.fn(),
	requestEmailChange: vi.fn(),
	resendVerificationEmail: vi.fn(),
	resetPassword: vi.fn()
}));

const user = {
	id: 1,
	name: 'Rani',
	username: 'rani',
	email: 'rani@sakala.local',
	avatar_url: null,
	role: 'user',
	onboarding_source: null,
	onboarding_role: null,
	onboarding_completed_at: null,
	last_login_at: null,
	has_password: true,
	legal_acceptance_required: false,
	pending_email: null as string | null,
	created_at: null
};
const options = (email_delivery_enabled: boolean) => ({
	email_delivery_enabled,
	providers: { github: true, google: false },
	legal: {
		terms_version: 'syarat-v1',
		acceptable_use_version: 'penggunaan-wajar-v1',
		privacy_notice_version: 'privasi-v1'
	}
});
const renderTab = () => render(QueryTestHost, { props: { component: AccountSettingsTab } });
const emailField = () => page.getByLabelText('Email baru');

beforeEach(() => {
	vi.mocked(getCurrentUser).mockReset().mockResolvedValue(user);
	vi.mocked(getAuthOptions).mockReset();
	vi.mocked(requestEmailChange).mockReset();
});

describe('AccountSettingsTab and email delivery', () => {
	it('replaces the email change form with the honest reason when delivery is off', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderTab();

		await expect.element(page.getByText('Ganti email belum tersedia')).toBeVisible();
		await expect.element(emailField()).not.toBeInTheDocument();
		await expect.element(page.getByRole('heading', { name: 'Ubah kata sandi' })).toBeVisible();
	});

	it('does not ask to open a link that never arrived when delivery is off', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({ ...user, pending_email: 'baru@sakala.local' });
		vi.mocked(getAuthOptions).mockResolvedValue(options(false));
		renderTab();

		await expect.element(page.getByText('Ganti email belum tersedia')).toBeVisible();
		await expect.element(page.getByText('Cek email baru')).not.toBeInTheDocument();
	});

	it('keeps the form when delivery is on', async () => {
		vi.mocked(getAuthOptions).mockResolvedValue(options(true));
		renderTab();

		await expect.element(emailField()).toBeVisible();
		await expect.element(page.getByText('Ganti email belum tersedia')).not.toBeInTheDocument();
	});

	it('shows neither the form nor the reason while the flag is loading', async () => {
		vi.mocked(getAuthOptions).mockReturnValue(new Promise(() => {}));
		renderTab();

		await expect
			.element(page.getByRole('progressbar', { name: 'Memuat pilihan ganti email' }))
			.toBeInTheDocument();
		await expect.element(emailField()).not.toBeInTheDocument();
		await expect.element(page.getByText('Ganti email belum tersedia')).not.toBeInTheDocument();
	});

	it('keeps the form on fetch failure and shows the refusal from the API', async () => {
		vi.mocked(getAuthOptions).mockRejectedValue(new Error('offline'));
		vi.mocked(requestEmailChange).mockRejectedValue(
			apiErrorFromResponse(503, {
				code: 'EMAIL_DELIVERY_UNAVAILABLE',
				apiMessage: 'Sakala belum bisa mengirim email untuk saat ini.'
			})
		);
		renderTab();

		await emailField().fill('baru@sakala.local');
		await page.getByLabelText('Kata sandi saat ini', { exact: true }).fill('kata-sandi');
		await page.getByRole('button', { name: 'Ubah email' }).click();

		await expect
			.element(page.getByRole('alert'))
			.toHaveTextContent('Sakala belum bisa mengirim email untuk saat ini.');
	});
});
