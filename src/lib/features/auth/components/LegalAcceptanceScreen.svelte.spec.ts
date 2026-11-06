import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiErrorFromResponse } from '$lib/api/errors';
import { acceptLegalDocuments, getAuthOptions } from '$lib/api/resources/auth';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import LegalAcceptanceScreen from './LegalAcceptanceScreen.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/realtime/echo', () => ({ disconnectEcho: vi.fn() }));
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

const legal = {
	terms_version: 'syarat-v2',
	acceptable_use_version: 'penggunaan-wajar-v2',
	privacy_notice_version: 'privasi-v1'
};
const submit = () => page.getByRole('button', { name: 'Setuju dan lanjutkan' });

beforeEach(() => {
	vi.mocked(acceptLegalDocuments).mockReset();
	vi.mocked(getAuthOptions)
		.mockReset()
		.mockResolvedValue({
			email_delivery_enabled: true,
			providers: { github: true, google: false },
			legal
		});
});

describe('LegalAcceptanceScreen', () => {
	it('records nothing until the box is ticked', async () => {
		render(QueryTestHost, { props: { component: LegalAcceptanceScreen } });
		await submit().click();

		await expect.element(page.getByText(/Centang pernyataan ini dulu/)).toBeVisible();
		expect(acceptLegalDocuments).not.toHaveBeenCalled();
	});

	it('accepts the versions on screen, whichever those are', async () => {
		vi.mocked(acceptLegalDocuments).mockResolvedValue({} as never);
		render(QueryTestHost, { props: { component: LegalAcceptanceScreen } });
		await page.getByRole('checkbox').click();
		await submit().click();

		expect(acceptLegalDocuments).toHaveBeenCalledWith({
			accept_terms: true,
			terms_version: 'syarat-v2',
			acceptable_use_version: 'penggunaan-wajar-v2'
		});
	});

	it('asks again when a document changed in the meantime', async () => {
		vi.mocked(acceptLegalDocuments).mockRejectedValue(
			apiErrorFromResponse(422, { errors: { terms_version: ['Versi lama.'] } })
		);
		render(QueryTestHost, { props: { component: LegalAcceptanceScreen } });
		await page.getByRole('checkbox').click();
		await submit().click();

		await expect.element(page.getByText(/baru saja diperbarui/)).toBeVisible();
		await expect.element(page.getByRole('checkbox')).not.toBeChecked();
	});

	it('leaves a way out for someone who does not agree', async () => {
		render(QueryTestHost, { props: { component: LegalAcceptanceScreen } });

		await expect
			.element(page.getByRole('link', { name: 'Unduh data atau hapus akun' }))
			.toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Keluar' })).toBeVisible();
	});
});
