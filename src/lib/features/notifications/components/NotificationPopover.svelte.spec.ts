import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	listNotifications,
	markNotificationRead,
	type Notification
} from '$lib/api/resources/notifications';
import { NetworkError } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import NotificationPopover from './NotificationPopover.svelte';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/api/resources/notifications', () => ({
	getNotificationPreferences: vi.fn(),
	getUnreadNotificationCount: vi.fn(),
	listNotifications: vi.fn(),
	markAllNotificationsRead: vi.fn(),
	markNotificationRead: vi.fn(),
	updateNotificationPreferences: vi.fn()
}));

const unread: Notification = {
	id: 'n-1',
	category: 'deployment_failure',
	title: 'Deployment gagal',
	message: 'Build sakala-console gagal.',
	project_id: 'p1',
	deployment_id: 'd1',
	invitation_id: null,
	workspace_id: null,
	read_at: null,
	created_at: '2026-10-01T00:00:00+00:00'
};

const read: Notification = {
	...unread,
	id: 'n-2',
	category: 'account_security',
	title: 'Kata sandi diganti',
	message: 'Kata sandi akun kamu diperbarui.',
	project_id: null,
	deployment_id: null,
	read_at: '2026-10-01T01:00:00+00:00'
};

function respondWith(items: Notification[]) {
	vi.mocked(listNotifications).mockResolvedValue({
		data: items,
		meta: { current_page: 1, last_page: 1, total: items.length }
	});
}

function renderPopover(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, { props: { component: NotificationPopover, props } });
}

beforeEach(() => {
	vi.mocked(listNotifications).mockReset();
	vi.mocked(markNotificationRead).mockReset().mockResolvedValue(undefined);
	vi.mocked(goto).mockClear();
});

describe('NotificationPopover', () => {
	it('shows the unread dot only when the API count says so', async () => {
		respondWith([]);
		await renderPopover({ unreadCount: 3 });

		await expect
			.element(page.getByRole('button', { name: 'Buka notifikasi, 3 belum dibaca' }))
			.toBeVisible();
		await expect.element(page.getByTestId('bell-unread-dot')).toBeInTheDocument();
	});

	it('shows no dot when the count is zero', async () => {
		respondWith([]);
		await renderPopover({ unreadCount: 0 });

		await expect.element(page.getByRole('button', { name: 'Buka notifikasi' })).toBeVisible();
		await expect.element(page.getByTestId('bell-unread-dot')).not.toBeInTheDocument();
	});

	it('does not fetch the list until it is opened', async () => {
		respondWith([unread]);
		await renderPopover();

		await page.getByRole('button', { name: 'Buka notifikasi' }).click();

		await expect.element(page.getByText('Build sakala-console gagal.')).toBeVisible();
		expect(listNotifications).toHaveBeenCalledWith({ page: 1, perPage: 10 });
	});

	it('lists what the API returned, with the unread state', async () => {
		respondWith([unread, read]);
		await renderPopover({ open: true });

		await expect.element(page.getByText('Deployment gagal')).toBeVisible();
		await expect.element(page.getByText('Kata sandi diganti')).toBeVisible();
		await expect.element(page.getByTestId('unread-dot')).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Lihat semua' }))
			.toHaveAttribute('href', '/notifications');
	});

	it('shows the empty state from Figma when there is nothing', async () => {
		respondWith([]);
		await renderPopover({ open: true });

		await expect.element(page.getByText('Tidak ada notifikasi')).toBeVisible();
	});

	it('explains a failed load and can retry, rather than reading as empty', async () => {
		vi.mocked(listNotifications).mockRejectedValueOnce(new NetworkError());
		await renderPopover({ open: true });

		await expect.element(page.getByText('Sakala API tidak dapat dijangkau.')).toBeVisible();
		await expect.element(page.getByText('Tidak ada notifikasi')).not.toBeInTheDocument();

		respondWith([read]);
		await page.getByRole('button', { name: 'Coba lagi' }).click();

		await expect.element(page.getByText('Kata sandi diganti')).toBeVisible();
	});

	it('marks an unread item as read and opens what it is about', async () => {
		respondWith([unread]);
		await renderPopover({ open: true });

		await page.getByText('Build sakala-console gagal.').click();

		await vi.waitFor(() => expect(markNotificationRead).toHaveBeenCalled());
		expect(vi.mocked(markNotificationRead).mock.calls[0][0]).toBe('n-1');
		expect(goto).toHaveBeenCalledWith('/projects/p1/deployments/d1');
	});

	it('does not send a read request for an item already read', async () => {
		respondWith([read]);
		await renderPopover({ open: true });

		await page.getByText('Kata sandi akun kamu diperbarui.').click();

		await vi.waitFor(() => expect(goto).toHaveBeenCalledWith('/notifications'));
		expect(markNotificationRead).not.toHaveBeenCalled();
	});
});
