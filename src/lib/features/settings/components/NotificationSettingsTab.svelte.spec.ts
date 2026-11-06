import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	getNotificationPreferences,
	updateNotificationPreferences
} from '$lib/api/resources/notifications';
import { apiErrorFromResponse } from '$lib/api/errors';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import NotificationSettingsTab from './NotificationSettingsTab.svelte';

vi.mock('$lib/api/resources/notifications', () => ({
	getNotificationPreferences: vi.fn(),
	getUnreadNotificationCount: vi.fn(),
	listNotifications: vi.fn(),
	markAllNotificationsRead: vi.fn(),
	markNotificationRead: vi.fn(),
	updateNotificationPreferences: vi.fn()
}));

const saved = {
	deployment_success: true,
	deployment_failure: true,
	project_issue: false,
	account_security: true
};

beforeEach(() => {
	vi.mocked(getNotificationPreferences).mockReset().mockResolvedValue(saved);
	vi.mocked(updateNotificationPreferences).mockReset();
});

const renderTab = () => render(QueryTestHost, { props: { component: NotificationSettingsTab } });
const saveButton = () => page.getByRole('button', { name: 'Simpan Perubahan' });

describe('NotificationSettingsTab (U-10)', () => {
	it('shows what the API has saved, not a local default', async () => {
		renderTab();

		await expect
			.element(page.getByRole('switch', { name: 'Masalah Proyek' }))
			.toHaveAttribute('aria-checked', 'false');
		await expect
			.element(page.getByRole('switch', { name: 'Deployment Berhasil' }))
			.toHaveAttribute('aria-checked', 'true');
		await expect.element(saveButton()).toBeDisabled();
	});

	it('offers only the categories the API knows', async () => {
		renderTab();

		await expect.element(page.getByRole('switch', { name: 'Masalah Proyek' })).toBeVisible();
		await expect.element(page.getByRole('switch')).toHaveLength(5);
		await expect.element(page.getByText('Penawaran Khusus')).not.toBeInTheDocument();
		await expect.element(page.getByText('Peringatan Suara')).not.toBeInTheDocument();
	});

	it('saves only what changed, and is not dirty afterwards', async () => {
		vi.mocked(updateNotificationPreferences).mockResolvedValue({
			...saved,
			account_security: false
		});
		renderTab();

		await page.getByRole('switch', { name: 'Keamanan Akun' }).click();
		await saveButton().click();

		await vi.waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalled());
		expect(vi.mocked(updateNotificationPreferences).mock.calls[0][0]).toEqual({
			account_security: false
		});
		await expect.element(page.getByText('Pengaturan notifikasi tersimpan.')).toBeVisible();
		await expect.element(saveButton()).toBeDisabled();
	});

	it('keeps the edit and says so when saving fails', async () => {
		vi.mocked(updateNotificationPreferences).mockRejectedValue(apiErrorFromResponse(500));
		renderTab();

		await page.getByRole('switch', { name: 'Masalah Proyek' }).click();
		await saveButton().click();

		await expect.element(page.getByRole('alert')).toBeVisible();
		await expect
			.element(page.getByText('Pengaturan notifikasi tersimpan.'))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('switch', { name: 'Masalah Proyek' }))
			.toHaveAttribute('aria-checked', 'true');
	});

	it('the master switch turns everything on or off', async () => {
		vi.mocked(updateNotificationPreferences).mockResolvedValue(saved);
		renderTab();

		await page.getByRole('switch', { name: 'Aktifkan Semua Notifikasi' }).click();
		await saveButton().click();

		await vi.waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalled());
		expect(vi.mocked(updateNotificationPreferences).mock.calls[0][0]).toEqual({
			project_issue: true
		});
	});

	it('explains a failed load instead of showing defaults', async () => {
		vi.mocked(getNotificationPreferences).mockRejectedValue(apiErrorFromResponse(500));
		renderTab();

		await expect.element(page.getByRole('alert')).toBeVisible();
		await expect.element(page.getByRole('switch')).toHaveLength(0);
	});
});
