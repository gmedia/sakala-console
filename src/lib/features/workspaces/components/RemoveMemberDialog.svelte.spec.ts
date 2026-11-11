import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parseMemberList, removeWorkspaceMember } from '$lib/api/resources/workspaces';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromFixture, getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import RemoveMemberDialog from './RemoveMemberDialog.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/workspaces', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/workspaces')>()),
	removeWorkspaceMember: vi.fn()
}));

const WORKSPACE_ID = '01a1cb4a-de55-72db-b810-80611beec465';
const [owner, member] = parseMemberList(getWorkspaceFixture('members').body);

const open = (target = member) =>
	render(QueryTestHost, {
		props: {
			component: RemoveMemberDialog,
			props: {
				open: true,
				workspaceId: WORKSPACE_ID,
				workspaceName: 'Tim Facility',
				member: target
			}
		}
	});
const dialog = () => page.getByRole('dialog');
const confirm = () => dialog().getByRole('button', { name: /Keluarkan|Mengeluarkan/ });

beforeEach(() => {
	vi.mocked(removeWorkspaceMember).mockReset();
});

describe('RemoveMemberDialog', () => {
	it('names the person and what they lose', async () => {
		await open();
		await expect.element(dialog()).toHaveTextContent('Keluarkan Bima Saputra?');
		await expect
			.element(dialog())
			.toHaveTextContent(/langsung kehilangan akses ke semua proyek di Tim Facility/);
	});

	it('focuses Batal, not the destructive button, when it opens', async () => {
		await open();
		await expect.element(dialog().getByRole('button', { name: 'Batal' })).toHaveFocus();
		await expect.element(confirm()).not.toHaveFocus();
	});

	it('removes by membership ID, once, however often the button is pressed', async () => {
		let finish: () => void = () => {};
		vi.mocked(removeWorkspaceMember).mockReturnValue(
			new Promise<void>((resolve) => (finish = resolve))
		);
		await open();
		await confirm().click();
		await confirm().click({ force: true });

		expect(removeWorkspaceMember).toHaveBeenCalledTimes(1);
		expect(removeWorkspaceMember).toHaveBeenCalledWith(WORKSPACE_ID, member.id);
		await expect.element(confirm()).toBeDisabled();
		finish();
		await expect.element(dialog()).not.toBeInTheDocument();
	});

	it('stays open and explains the last-owner refusal', async () => {
		vi.mocked(removeWorkspaceMember).mockRejectedValue(
			errorFromFixture('member-remove-last-owner')
		);
		await open(owner);
		await confirm().click();

		await expect
			.element(dialog().getByRole('alert'))
			.toHaveTextContent(/harus selalu punya pemilik/);
		await expect.element(confirm()).toBeEnabled();
	});

	it('closes without a request when cancelled', async () => {
		await open();
		await dialog().getByRole('button', { name: 'Batal' }).click();

		await expect.element(dialog()).not.toBeInTheDocument();
		expect(removeWorkspaceMember).not.toHaveBeenCalled();
	});
});
