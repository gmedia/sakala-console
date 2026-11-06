import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../client';
import {
	getNotificationPreferences,
	getUnreadNotificationCount,
	listNotifications,
	markAllNotificationsRead,
	markNotificationRead,
	updateNotificationPreferences
} from './notifications';

vi.mock('../client', () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

const notification = {
	id: '0198c5e0-7c1d-7000-8000-000000000001',
	category: 'deployment_failure',
	title: 'Deployment gagal',
	message: 'Build gagal.',
	project_id: 'p1',
	deployment_id: 'd1',
	read_at: null,
	created_at: '2026-10-01T00:00:00+00:00'
};

const preferences = {
	deployment_success: true,
	deployment_failure: true,
	project_issue: false,
	account_security: true
};

beforeEach(() => mockedApiRequest.mockReset());

describe('notifications resource (U-09, U-10)', () => {
	it('lists under /app, sends the unread filter as 1, and accepts null fields', async () => {
		mockedApiRequest.mockResolvedValue({
			data: [notification],
			meta: { current_page: 2, last_page: 3, total: 17 }
		});

		const page = await listNotifications({ page: 2, perPage: 8, unreadOnly: true });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/app/notifications', {
			params: { page: 2, per_page: 8, unread: 1 }
		});
		expect(page.data[0].read_at).toBeNull();
		expect(page.meta.last_page).toBe(3);
	});

	it('omits the unread filter when listing everything', async () => {
		mockedApiRequest.mockResolvedValue({
			data: [],
			meta: { current_page: 1, last_page: 1, total: 0 }
		});

		await listNotifications({ page: 1 });

		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/app/notifications', {
			params: { page: 1, per_page: undefined, unread: undefined }
		});
	});

	it('reads the unread count from the path and shape the API serves', async () => {
		mockedApiRequest.mockResolvedValue({ data: { count: 4 } });

		await expect(getUnreadNotificationCount()).resolves.toBe(4);
		expect(mockedApiRequest).toHaveBeenCalledWith('api/v1/app/notifications/unread-count');
	});

	it('marks one and all as read with POST', async () => {
		mockedApiRequest.mockResolvedValue(undefined);

		await markNotificationRead(notification.id);
		await markAllNotificationsRead();

		expect(mockedApiRequest).toHaveBeenNthCalledWith(
			1,
			`api/v1/app/notifications/${notification.id}/read`,
			{ method: 'POST' }
		);
		expect(mockedApiRequest).toHaveBeenNthCalledWith(2, 'api/v1/app/notifications/read-all', {
			method: 'POST'
		});
	});

	it('reads preferences and saves only what changed', async () => {
		mockedApiRequest.mockResolvedValue({ data: preferences });

		await expect(getNotificationPreferences()).resolves.toEqual(preferences);
		await updateNotificationPreferences({ project_issue: false });

		expect(mockedApiRequest).toHaveBeenLastCalledWith('api/v1/app/notification-preferences', {
			method: 'PATCH',
			json: { project_issue: false }
		});
	});
});
