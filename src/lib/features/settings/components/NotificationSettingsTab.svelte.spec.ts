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
	account_security: true,
	workspace: false,
	email: { deployment_success: false, deployment_failure: true, project_issue: true }
};

beforeEach(() => {
	vi.mocked(getNotificationPreferences).mockReset().mockResolvedValue(saved);
	vi.mocked(updateNotificationPreferences).mockReset();
});

const renderTab = () => render(QueryTestHost, { props: { component: NotificationSettingsTab } });
const bell = (title: string) => page.getByRole('switch', { name: `Lonceng: ${title}` });
const email = (title: string) => page.getByRole('switch', { name: `Email: ${title}` });

describe('NotificationSettingsTab', () => {
	it('shows both channels as the API saved them, not a local default', async () => {
		await renderTab();

		await expect.element(bell('Masalah proyek')).toHaveAttribute('aria-checked', 'false');
		await expect.element(email('Masalah proyek')).toHaveAttribute('aria-checked', 'true');
		await expect.element(bell('Deployment berhasil')).toHaveAttribute('aria-checked', 'true');
		await expect.element(email('Deployment berhasil')).toHaveAttribute('aria-checked', 'false');
		await expect
			.element(page.getByRole('button', { name: 'Simpan perubahan' }))
			.not.toBeInTheDocument();
	});

	it('offers email only for the three categories the API emails', async () => {
		await renderTab();

		// 5 bell switches, 3 email switches, and the master switch.
		await expect.element(page.getByRole('switch')).toHaveLength(9);
		await expect
			.element(page.getByRole('switch', { name: 'Email: Perubahan kata sandi dan email' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByTestId('notification-row-account_security'))
			.toHaveTextContent(/Email penting selalu dikirim/);
		await expect
			.element(page.getByTestId('notification-row-workspace'))
			.toHaveTextContent(/Email penting selalu dikirim/);
	});

	it('saves a bell switch the moment it moves, and says so beside it', async () => {
		vi.mocked(updateNotificationPreferences).mockResolvedValue({
			...saved,
			account_security: false
		});
		await renderTab();

		await bell('Perubahan kata sandi dan email').click();

		await vi.waitFor(() =>
			expect(updateNotificationPreferences).toHaveBeenCalledWith({ account_security: false })
		);
		await expect
			.element(page.getByTestId('notification-row-account_security'))
			.toHaveTextContent(/Tersimpan/);
		await expect
			.element(bell('Perubahan kata sandi dan email'))
			.toHaveAttribute('aria-checked', 'false');
	});

	it('sends only the email key that changed', async () => {
		vi.mocked(updateNotificationPreferences).mockResolvedValue({
			...saved,
			email: { ...saved.email, deployment_success: true }
		});
		await renderTab();

		await email('Deployment berhasil').click();

		await vi.waitFor(() =>
			expect(updateNotificationPreferences).toHaveBeenCalledWith({
				email: { deployment_success: true }
			})
		);
		await expect.element(email('Deployment berhasil')).toHaveAttribute('aria-checked', 'true');
		// The bell for the same category did not move.
		await expect.element(bell('Deployment berhasil')).toHaveAttribute('aria-checked', 'true');
	});

	it('puts the switch back and shows the field error when the API refuses', async () => {
		vi.mocked(updateNotificationPreferences).mockRejectedValue(
			apiErrorFromResponse(422, {
				errors: { 'email.project_issue': ['Pilihan email ini tidak bisa diubah sekarang.'] }
			})
		);
		await renderTab();

		await email('Masalah proyek').click();

		await expect
			.element(page.getByText('Pilihan email ini tidak bisa diubah sekarang.'))
			.toBeVisible();
		await expect.element(email('Masalah proyek')).toHaveAttribute('aria-checked', 'true');
	});

	it('puts the switch back when saving fails for another reason', async () => {
		vi.mocked(updateNotificationPreferences).mockRejectedValue(apiErrorFromResponse(500));
		await renderTab();

		await bell('Masalah proyek').click();

		await expect
			.element(page.getByTestId('notification-row-project_issue').getByRole('alert'))
			.toBeVisible();
		await expect.element(bell('Masalah proyek')).toHaveAttribute('aria-checked', 'false');
	});

	it('the master switch turns every bell category on, and leaves email alone', async () => {
		vi.mocked(updateNotificationPreferences).mockResolvedValue({
			...saved,
			project_issue: true,
			workspace: true
		});
		await renderTab();

		await page.getByRole('switch', { name: 'Semua notifikasi lonceng' }).click();

		await vi.waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalled());
		const change = vi.mocked(updateNotificationPreferences).mock.calls[0][0];
		expect(change).toEqual({
			deployment_success: true,
			deployment_failure: true,
			project_issue: true,
			workspace: true,
			account_security: true
		});
		expect(change).not.toHaveProperty('email');
	});

	it('explains a failed load instead of showing defaults', async () => {
		vi.mocked(getNotificationPreferences).mockRejectedValue(apiErrorFromResponse(500));
		await renderTab();

		await expect.element(page.getByRole('alert')).toBeVisible();
		await expect.element(page.getByRole('switch')).toHaveLength(0);
	});
});
