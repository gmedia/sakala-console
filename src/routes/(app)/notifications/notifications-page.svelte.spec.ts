import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	getUnreadNotificationCount,
	listNotifications,
	markAllNotificationsRead
} from '$lib/api/resources/notifications';
import { listMyInvitations, parseInvitationList } from '$lib/api/resources/workspaces';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { getWorkspaceFixture } from '$lib/testing/workspace-fixtures';
import NotificationsPage from './+page.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));

vi.mock('$lib/api/resources/workspaces', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/workspaces')>()),
	listMyInvitations: vi.fn(),
	listWorkspaces: vi.fn().mockResolvedValue([])
}));

vi.mock('$lib/api/resources/notifications', () => ({
	getNotificationPreferences: vi.fn(),
	getUnreadNotificationCount: vi.fn(),
	listNotifications: vi.fn(),
	markAllNotificationsRead: vi.fn(),
	markNotificationRead: vi.fn(),
	updateNotificationPreferences: vi.fn()
}));

const item = (id: string, overrides = {}) => ({
	id,
	category: 'deployment_success',
	title: `Judul ${id}`,
	message: `Pesan ${id}`,
	project_id: null,
	deployment_id: null,
	invitation_id: null,
	workspace_id: null,
	read_at: null,
	created_at: '2026-10-01T00:00:00+00:00',
	...overrides
});

const renderPage = () => render(QueryTestHost, { props: { component: NotificationsPage } });

beforeEach(() => {
	vi.mocked(listNotifications).mockReset();
	vi.mocked(getUnreadNotificationCount).mockReset().mockResolvedValue(1);
	vi.mocked(markAllNotificationsRead).mockReset().mockResolvedValue(undefined);
	vi.mocked(listMyInvitations).mockReset().mockResolvedValue([]);
});

describe('workspace invitations on the notifications page', () => {
	it('puts pending invitations above the notifications, ready to answer', async () => {
		vi.mocked(listMyInvitations).mockResolvedValue(
			parseInvitationList(getWorkspaceFixture('invitations-mine').body)
		);
		vi.mocked(listNotifications).mockResolvedValue({
			data: [item('a', { category: 'workspace', title: 'Undangan workspace tim' })],
			meta: { current_page: 1, last_page: 1, total: 1 }
		});
		await renderPage();

		const invitations = page.getByTestId('my-invitations');
		await expect.element(invitations).toHaveTextContent(/Undangan ke Tim Facility/);
		await expect
			.element(invitations.getByRole('button', { name: 'Terima undangan' }))
			.toBeVisible();
	});

	it('shows nothing extra when there is no invitation', async () => {
		vi.mocked(listNotifications).mockResolvedValue({
			data: [item('a')],
			meta: { current_page: 1, last_page: 1, total: 1 }
		});
		await renderPage();

		await expect.element(page.getByText('Pesan a')).toBeVisible();
		await expect.element(page.getByTestId('my-invitations')).not.toBeInTheDocument();
	});
});

describe('NotificationCenter', () => {
	it('pages through the server, not through a local array', async () => {
		vi.mocked(listNotifications).mockImplementation(async ({ page: current = 1 } = {}) => ({
			data: [item(`halaman-${current}`)],
			meta: { current_page: current, last_page: 2, total: 9 }
		}));
		await renderPage();

		await expect.element(page.getByText('Pesan halaman-1')).toBeVisible();
		await page.getByRole('button', { name: 'Halaman 2' }).click();

		await expect.element(page.getByText('Pesan halaman-2')).toBeVisible();
		expect(listNotifications).toHaveBeenLastCalledWith({
			page: 2,
			perPage: 8,
			unreadOnly: false
		});
	});

	it('asks the server for unread only, and goes back to the first page', async () => {
		vi.mocked(listNotifications).mockResolvedValue({
			data: [item('a')],
			meta: { current_page: 1, last_page: 1, total: 1 }
		});
		await renderPage();

		await page.getByRole('button', { name: 'Belum dibaca', exact: true }).click();

		await vi.waitFor(() =>
			expect(listNotifications).toHaveBeenLastCalledWith({
				page: 1,
				perPage: 8,
				unreadOnly: true
			})
		);
	});

	it('marks all read through the API, and refreshes the list', async () => {
		vi.mocked(listNotifications).mockResolvedValue({
			data: [item('a')],
			meta: { current_page: 1, last_page: 1, total: 1 }
		});
		await renderPage();

		await page.getByRole('button', { name: 'Tandai semua telah dibaca' }).click();

		await vi.waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
		await vi.waitFor(() =>
			expect(vi.mocked(listNotifications).mock.calls.length).toBeGreaterThan(1)
		);
	});

	it('disables mark-all when the count is zero', async () => {
		vi.mocked(getUnreadNotificationCount).mockResolvedValue(0);
		vi.mocked(listNotifications).mockResolvedValue({
			data: [],
			meta: { current_page: 1, last_page: 1, total: 0 }
		});
		await renderPage();

		await expect
			.element(page.getByRole('button', { name: 'Tandai semua telah dibaca' }))
			.toBeDisabled();
		await expect.element(page.getByText('Tidak ada notifikasi')).toBeVisible();
	});
});
