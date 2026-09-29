import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationPopover from './NotificationPopover.svelte';
import type { NotificationItem } from '../types';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

const testNotifications: NotificationItem[] = [
	{
		id: 'notif-1',
		message: 'Deployment production berhasil untuk repositori sakala-console.',
		timestamp: '19.00',
		is_read: false,
		type: 'deployment'
	},
	{
		id: 'notif-2',
		message: 'Selamat datang di Sakala Console! Hubungkan GitHub kamu.',
		timestamp: '18.30',
		is_read: true,
		type: 'welcome'
	}
];

describe('NotificationPopover', () => {
	it('menampilkan ikon lonceng dan membuka popover saat diklik', async () => {
		render(NotificationPopover, {
			notifications: testNotifications
		});

		const trigger = page.getByRole('button', { name: 'Buka notifikasi' });
		await expect.element(trigger).toBeVisible();

		await trigger.click();

		const heading = page.getByRole('heading', { name: 'Notifikasi' });
		await expect.element(heading).toBeVisible();

		const searchInput = page.getByPlaceholder('Cari...');
		await expect.element(searchInput).toBeVisible();

		const seeAllLink = page.getByRole('link', { name: 'Lihat Semua' });
		await expect.element(seeAllLink).toBeVisible();
		await expect.element(seeAllLink).toHaveAttribute('href', '/notifications');
	});

	it('menampilkan daftar notifikasi dengan pesan, jam, dan status unread', async () => {
		render(NotificationPopover, {
			notifications: testNotifications,
			open: true
		});

		const item1 = page.getByText('Deployment production berhasil untuk repositori sakala-console.');
		await expect.element(item1).toBeVisible();

		const item2 = page.getByText('Selamat datang di Sakala Console! Hubungkan GitHub kamu.');
		await expect.element(item2).toBeVisible();

		const unreadIndicator = page.getByTestId('unread-dot');
		await expect.element(unreadIndicator).toBeInTheDocument();
	});

	it('dapat memfilter notifikasi dengan input pencarian', async () => {
		render(NotificationPopover, {
			notifications: testNotifications,
			open: true
		});

		const searchInput = page.getByPlaceholder('Cari...');
		await searchInput.fill('production');

		await expect
			.element(page.getByText('Deployment production berhasil untuk repositori sakala-console.'))
			.toBeVisible();
		await expect
			.element(page.getByText('Selamat datang di Sakala Console! Hubungkan GitHub kamu.'))
			.not.toBeInTheDocument();
	});

	it('menampilkan status kosong saat pencarian tidak menemukan hasil', async () => {
		render(NotificationPopover, {
			notifications: testNotifications,
			open: true
		});

		const searchInput = page.getByPlaceholder('Cari...');
		await searchInput.fill('kata kunci yang tidak ada sama sekali');

		const emptyNotice = page.getByText('Tidak ada notifikasi yang sesuai');
		await expect.element(emptyNotice).toBeVisible();
	});

	it('menampilkan empty state jika daftar notifikasi kosong', async () => {
		render(NotificationPopover, {
			notifications: [],
			open: true
		});

		const emptyNotice = page.getByText('Tidak ada Notifikasi');
		await expect.element(emptyNotice).toBeVisible();
	});

	it('memanggil callback onSelectNotification dan menandai item sebagai sudah dibaca', async () => {
		const onSelectNotification = vi.fn();

		render(NotificationPopover, {
			notifications: testNotifications,
			open: true,
			onSelectNotification
		});

		const itemButton = page.getByText(
			'Deployment production berhasil untuk repositori sakala-console.'
		);
		await itemButton.click();

		expect(onSelectNotification).toHaveBeenCalledTimes(1);
		expect(onSelectNotification).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 'notif-1'
			})
		);
	});
});
