import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiErrorFromResponse } from '$lib/api/errors';
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

const open = (memberEmails: string[] = []) =>
	render(QueryTestHost, {
		props: {
			component: InviteMemberDialog,
			props: { open: true, workspaceId: WORKSPACE_ID, workspaceName: 'Tim Facility', memberEmails }
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
			.toHaveTextContent('bima@kampus.test sudah menjadi anggota workspace ini.');
		await expect.element(dialog()).toBeInTheDocument();
	});

	it('names the address beside the API’s validation message', async () => {
		vi.mocked(inviteToWorkspace).mockRejectedValue(errorFromFixture('invitation-create-invalid'));
		await open();
		await email().fill('dewi@kampus.test');
		await send().click();

		await expect
			.element(dialog().getByRole('alert'))
			.toHaveTextContent(
				'dewi@kampus.test: Kolom email harus berupa alamat email, misalnya nama@contoh.com.'
			);
		// The address stays in the field, to fix and send again.
		await expect.element(email()).toHaveValue('dewi@kampus.test');
	});

	describe('several addresses', () => {
		const pasted = [
			'fajar@kampus.test',
			'gita@kampus',
			'hana@kampus.test',
			'bima@kampus.test',
			'indra@kampus.test'
		].join('\n');

		/** What a paste does to the field: the text, plus the paste event that shows the review. */
		async function paste(value: string) {
			await email().fill(value);
			email()
				.element()
				.dispatchEvent(new Event('paste', { bubbles: true }));
		}

		it('shows what will be left out before sending, and counts the rest on the button', async () => {
			await open(['bima@kampus.test']);
			await paste(pasted);

			const review = page.getByTestId('invite-review');
			await expect
				.element(review)
				.toHaveTextContent('3 alamat siap diundang, 2 tidak ikut dikirim');
			await expect
				.element(review)
				.toHaveTextContent('gita@kampus belum berupa alamat email lengkap');
			await expect
				.element(review)
				.toHaveTextContent('bima@kampus.test sudah menjadi anggota workspace ini.');
			await expect
				.element(dialog().getByRole('button', { name: 'Kirim 3 undangan' }))
				.toBeVisible();
		});

		it('invites the three that can be invited, and keeps the malformed one to fix', async () => {
			vi.mocked(inviteToWorkspace).mockResolvedValue(invitation);
			await open(['bima@kampus.test']);
			await paste(pasted);
			await dialog().getByRole('button', { name: 'Kirim 3 undangan' }).click();

			await expect
				.poll(() => vi.mocked(inviteToWorkspace).mock.calls.map(([, body]) => body.email))
				.toEqual(['fajar@kampus.test', 'hana@kampus.test', 'indra@kampus.test']);
			const outcome = dialog().getByRole('alert');
			await expect.element(outcome).toHaveTextContent('3 undangan terkirim.');
			await expect
				.element(outcome)
				.toHaveTextContent('gita@kampus belum berupa alamat email lengkap');
			await expect.element(outcome).toHaveTextContent('bima@kampus.test sudah menjadi anggota');
			await expect.element(email()).toHaveValue('gita@kampus');
		});

		it('stops at the invitation limit and says how many were not sent', async () => {
			vi.mocked(inviteToWorkspace)
				.mockResolvedValueOnce(invitation)
				.mockRejectedValueOnce(apiErrorFromResponse(429, { retryAfterSeconds: 120 }));
			await open();
			await paste('a@kampus.test\nb@kampus.test\nc@kampus.test');
			await dialog().getByRole('button', { name: 'Kirim 3 undangan' }).click();

			await expect
				.element(dialog().getByRole('alert'))
				.toHaveTextContent(
					/1 undangan terkirim\..*2 alamat belum dikirim\. Terlalu banyak permintaan/
				);
			expect(inviteToWorkspace).toHaveBeenCalledTimes(2);
			await expect.element(email()).toHaveValue('b@kampus.test\nc@kampus.test');
		});

		it('closes and says how many went out when every address was sent', async () => {
			vi.mocked(inviteToWorkspace).mockResolvedValue(invitation);
			await open();
			await email().fill('a@kampus.test, b@kampus.test');
			await dialog().getByRole('button', { name: 'Kirim 2 undangan' }).click();

			await expect.element(dialog()).not.toBeInTheDocument();
			expect(inviteToWorkspace).toHaveBeenCalledTimes(2);
		});
	});
});
