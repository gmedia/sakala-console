import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiErrorFromResponse } from '$lib/api/errors';
import { deleteAccount, getAuthOptions, getCurrentUser } from '$lib/api/resources/auth';
import { getPilotLimits } from '$lib/api/resources/pilot-limits';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import DeleteAccountSection from './DeleteAccountSection.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/realtime/echo', () => ({ disconnectEcho: vi.fn() }));
vi.mock('$lib/api/resources/pilot-limits', () => ({ getPilotLimits: vi.fn() }));
vi.mock('$lib/api/resources/auth', () => ({
	acceptLegalDocuments: vi.fn(),
	changePassword: vi.fn(),
	deleteAccount: vi.fn(),
	exportAccountData: vi.fn(),
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
	pending_email: null,
	created_at: null
};

const open = async () => {
	await render(QueryTestHost, { props: { component: DeleteAccountSection } });
	await page.getByRole('button', { name: 'Hapus akun saya' }).click();
};
const confirm = () => page.getByRole('dialog').getByRole('button', { name: 'Hapus akun saya' });
const emailField = () => page.getByLabelText('Ketik email akunmu untuk konfirmasi');

beforeEach(() => {
	vi.mocked(deleteAccount).mockReset();
	vi.mocked(getCurrentUser).mockReset().mockResolvedValue(user);
	vi.mocked(getAuthOptions)
		.mockReset()
		.mockResolvedValue({
			email_delivery_enabled: true,
			providers: { github: true, google: false },
			legal: {
				terms_version: 'syarat-v1',
				acceptable_use_version: 'penggunaan-wajar-v1',
				privacy_notice_version: 'privasi-v1'
			}
		});
	vi.mocked(getPilotLimits)
		.mockReset()
		.mockResolvedValue({ deleted_project_retention_days: 45 } as never);
});

describe('DeleteAccountSection', () => {
	it('states the retention the API reports, not a number of its own', async () => {
		await open();
		await expect.element(page.getByTestId('delete-account-retention')).toHaveTextContent(/45 hari/);
	});

	it('names no number when the API did not answer', async () => {
		vi.mocked(getPilotLimits).mockRejectedValue(new Error('offline'));
		await open();
		await expect
			.element(page.getByTestId('delete-account-retention'))
			.toHaveTextContent(/masa simpannya berakhir/);
	});

	it('stays locked until the email and the password are both there', async () => {
		await open();
		await expect.element(confirm()).toBeDisabled();

		await emailField().fill('orang-lain@sakala.local');
		await page.getByLabelText('Kata sandi saat ini', { exact: true }).fill('rahasia-sekali');
		await expect.element(confirm()).toBeDisabled();

		await emailField().fill('RANI@sakala.local');
		await expect.element(confirm()).toBeEnabled();
	});

	it('sends the password for an account that has one', async () => {
		vi.mocked(deleteAccount).mockResolvedValue(undefined);
		await open();
		await emailField().fill(user.email);
		await page.getByLabelText('Kata sandi saat ini', { exact: true }).fill('rahasia-sekali');
		await confirm().click();

		expect(deleteAccount).toHaveBeenCalledWith({
			email: user.email,
			current_password: 'rahasia-sekali'
		});
	});

	it('shows a wrong password on its field', async () => {
		vi.mocked(deleteAccount).mockRejectedValue(
			apiErrorFromResponse(422, { errors: { current_password: ['Kata sandi tidak cocok.'] } })
		);
		await open();
		await emailField().fill(user.email);
		await page.getByLabelText('Kata sandi saat ini', { exact: true }).fill('salah');
		await confirm().click();

		await expect.element(page.getByText('Kata sandi tidak cocok.')).toBeVisible();
	});

	it('sends a person without a password to log in again when the API asks for it', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({ ...user, has_password: false });
		vi.mocked(deleteAccount).mockRejectedValue(
			apiErrorFromResponse(403, {
				code: 'REAUTHENTICATION_REQUIRED',
				apiMessage: 'Demi keamanan, masuk ulang lewat GitHub atau Google dulu.'
			})
		);
		await open();
		await expect
			.element(page.getByLabelText('Kata sandi saat ini', { exact: true }))
			.not.toBeInTheDocument();
		await emailField().fill(user.email);
		await confirm().click();

		await expect.element(page.getByText(/Demi keamanan/)).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Masuk ulang lewat GitHub' }))
			.toBeVisible();
		expect(deleteAccount).toHaveBeenCalledWith({ email: user.email });
	});

	it('explains the admin case and offers no button that would only be refused', async () => {
		vi.mocked(getCurrentUser).mockResolvedValue({ ...user, role: 'admin' });
		await render(QueryTestHost, { props: { component: DeleteAccountSection } });

		await expect.element(page.getByTestId('delete-account-admin')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Hapus akun saya' }))
			.not.toBeInTheDocument();
	});
});
