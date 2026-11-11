import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiErrorFromResponse } from '$lib/api/errors';
import {
	acceptWorkspaceInvitation,
	getWorkspaceInvitation,
	parseInvitationDetails
} from '$lib/api/resources/workspaces';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromFixture, getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import InvitationLinkPage from './InvitationLinkPage.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));

vi.mock('$lib/api/resources/workspaces', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/workspaces')>()),
	getWorkspaceInvitation: vi.fn(),
	acceptWorkspaceInvitation: vi.fn(),
	declineWorkspaceInvitation: vi.fn(),
	listWorkspaces: vi.fn().mockResolvedValue([])
}));

const details = (name: string) => parseInvitationDetails(getWorkspaceFixture(name).body);

const renderPage = (props: { invitationId: string; token?: string }) =>
	render(QueryTestHost, { props: { component: InvitationLinkPage, props } });

beforeEach(() => {
	vi.mocked(getWorkspaceInvitation).mockReset();
	vi.mocked(acceptWorkspaceInvitation).mockReset();
});

describe('InvitationLinkPage', () => {
	it('reads the invitation through the token, even when it is not in this account’s list', async () => {
		vi.mocked(getWorkspaceInvitation).mockResolvedValue(details('invitation-details'));
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		await expect.element(page.getByText('Undangan ke Tim Facility')).toBeVisible();
		await expect.element(page.getByText(/Rani Putri mengundangmu sebagai/)).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Terima undangan' })).toBeEnabled();
		expect(getWorkspaceInvitation).toHaveBeenCalledWith('inv-1', 'dari-email');
	});

	it('reads it without a token for the invited address, as from a notification', async () => {
		vi.mocked(getWorkspaceInvitation).mockResolvedValue(details('invitation-details'));
		await renderPage({ invitationId: 'inv-1' });

		await expect.element(page.getByText('Undangan ke Tim Facility')).toBeVisible();
		expect(getWorkspaceInvitation).toHaveBeenCalledWith('inv-1', undefined);
	});

	it('says an owner invitation is for another address before anyone clicks, without accepting', async () => {
		vi.mocked(getWorkspaceInvitation).mockResolvedValue(
			details('invitation-details-owner-restricted')
		);
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		await expect.element(page.getByText('Undangan ini untuk email lain')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Terima undangan' }))
			.not.toBeInTheDocument();
		expect(acceptWorkspaceInvitation).not.toHaveBeenCalled();
	});

	it('offers to open the projects when this account already belongs to the team', async () => {
		vi.mocked(getWorkspaceInvitation).mockResolvedValue(
			details('invitation-details-already-member')
		);
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		await expect.element(page.getByText('Kamu sudah menjadi anggota')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Buka proyek' })).toBeVisible();
	});

	it.each([
		['invitation-details-accepted', 'Undangan sudah diterima'],
		['invitation-details-declined', 'Undangan sudah ditolak'],
		['invitation-details-revoked', 'Undangan sudah dibatalkan'],
		['invitation-details-expired', 'Undangan sudah kedaluwarsa'],
		['invitation-details-unverified', 'Verifikasi email dulu'],
		['invitation-details-not-found', 'Undangan tidak ditemukan']
	])('explains %s', async (name, title) => {
		vi.mocked(getWorkspaceInvitation).mockRejectedValue(errorFromFixture(name));
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		const alert = page.getByTestId('invitation-unreachable');
		await expect.element(alert).toHaveTextContent(title);
		await expect
			.element(page.getByRole('button', { name: 'Terima undangan' }))
			.not.toBeInTheDocument();
	});

	it('offers another try for a problem that may pass, such as the rate limit', async () => {
		vi.mocked(getWorkspaceInvitation)
			.mockRejectedValueOnce(apiErrorFromResponse(429, { retryAfterSeconds: 30 }))
			.mockResolvedValueOnce(details('invitation-details'));
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		await expect.element(page.getByText('Undangan belum bisa dimuat')).toBeVisible();
		await page.getByRole('button', { name: 'Coba lagi' }).click();
		await expect.element(page.getByText('Undangan ke Tim Facility')).toBeVisible();
	});

	it('explains a refusal that arrives only when accepting', async () => {
		vi.mocked(getWorkspaceInvitation).mockResolvedValue(details('invitation-details'));
		vi.mocked(acceptWorkspaceInvitation).mockRejectedValue(
			errorFromFixture('invitation-accept-revoked-token')
		);
		await renderPage({ invitationId: 'inv-1', token: 'dari-email' });

		await page.getByRole('button', { name: 'Terima undangan' }).click();
		await expect
			.element(page.getByTestId('invitation-problem'))
			.toHaveTextContent('Undangan sudah dibatalkan');
	});
});
