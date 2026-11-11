import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { inviteToWorkspace, parseInvitation } from '$lib/api/resources/workspaces';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromFixture, getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import InviteMemberDialog from './InviteMemberDialog.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/workspaces', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/workspaces')>()),
	inviteToWorkspace: vi.fn()
}));

const WORKSPACE_ID = '01a1cb4a-de55-72db-b810-80611beec465';
const invitation = parseInvitation(getWorkspaceFixture('invitation-create').body);

const open = () =>
	render(QueryTestHost, {
		props: {
			component: InviteMemberDialog,
			props: { open: true, workspaceId: WORKSPACE_ID, workspaceName: 'Tim Facility' }
		}
	});
const dialog = () => page.getByRole('dialog');
const send = () => dialog().getByRole('button', { name: 'Kirim undangan' });
const email = () => dialog().getByLabelText('Email');

beforeEach(() => {
	vi.mocked(inviteToWorkspace).mockReset();
});

describe('InviteMemberDialog', () => {
	it('names the workspace and defaults to the member role', async () => {
		await open();
		await expect.element(dialog()).toHaveTextContent(/bergabung ke Tim Facility/);
		await expect.element(dialog().getByRole('radio', { name: /Anggota/ })).toBeChecked();
	});

	it('catches an incomplete address before asking the API', async () => {
		await open();
		await email().fill('dewi@');
		await send().click();

		await expect.element(dialog().getByText(/Isi alamat email lengkap/)).toBeVisible();
		expect(inviteToWorkspace).not.toHaveBeenCalled();
	});

	it('sends the address and the chosen role, then closes', async () => {
		vi.mocked(inviteToWorkspace).mockResolvedValue(invitation);
		await open();
		await email().fill(' Dewi@Kampus.test ');
		await dialog()
			.getByRole('radio', { name: /Pengamat/ })
			.click();
		await send().click();

		expect(inviteToWorkspace).toHaveBeenCalledWith(WORKSPACE_ID, {
			email: 'Dewi@Kampus.test',
			role: 'viewer'
		});
		await expect.element(dialog()).not.toBeInTheDocument();
	});

	it('says that an owner invitation only works for that address', async () => {
		await open();
		await expect.element(page.getByTestId('owner-invite-note')).not.toBeInTheDocument();
		await dialog()
			.getByRole('radio', { name: /Pemilik/ })
			.click();
		await expect
			.element(page.getByTestId('owner-invite-note'))
			.toHaveTextContent(/hanya bisa diterima akun yang memakai email ini/);
	});

	it('sends once, however often the button is pressed while it waits', async () => {
		let finish: (value: typeof invitation) => void = () => {};
		vi.mocked(inviteToWorkspace).mockReturnValue(new Promise((resolve) => (finish = resolve)));
		await open();
		await email().fill('dewi@kampus.test');
		await send().click();
		await dialog()
			.getByRole('button', { name: /Mengirim/ })
			.click({ force: true });

		expect(inviteToWorkspace).toHaveBeenCalledTimes(1);
		await expect.element(dialog().getByRole('button', { name: /Mengirim/ })).toBeDisabled();
		finish(invitation);
		await expect.element(dialog()).not.toBeInTheDocument();
	});

	it('keeps the dialog open and explains an address that is already a member', async () => {
		vi.mocked(inviteToWorkspace).mockRejectedValue(errorFromFixture('invitation-create-member'));
		await open();
		await email().fill('bima@kampus.test');
		await send().click();

		await expect
			.element(dialog().getByRole('alert'))
			.toHaveTextContent('Orang ini sudah menjadi anggota workspace.');
		await expect.element(email()).toHaveValue('bima@kampus.test');
	});

	it('puts the API’s validation message on the email field', async () => {
		vi.mocked(inviteToWorkspace).mockRejectedValue(errorFromFixture('invitation-create-invalid'));
		await open();
		await email().fill('dewi@kampus.test');
		await send().click();

		await expect
			.element(
				dialog().getByText('Kolom email harus berupa alamat email, misalnya nama@contoh.com.')
			)
			.toBeVisible();
	});
});
