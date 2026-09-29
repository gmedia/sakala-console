import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import NotificationsPage from './+page.svelte';

import { notificationStore } from '$lib/features/notifications/store.svelte';

vi.mock('$app/state', () => ({
	page: {
		url: new URL('/notifications?id=notif-10', window.location.origin)
	}
}));

describe('NotificationsPage targetId pagination', () => {
	it('pindah ke halaman yang berisi item targetId dan menandai sebagai read', async () => {
		render(NotificationsPage);

		const targetItem = page.getByText(/Environment variables pada project Notification Service/);
		await expect.element(targetItem).toBeVisible();

		const page2Button = page.getByRole('button', { name: 'Page 2' });
		await expect.element(page2Button).toBeVisible();

		const itemInStore = notificationStore.all.find((i) => i.id === 'notif-10');
		expect(itemInStore?.is_read).toBe(true);

		const buttonContainer = targetItem.element().closest('button');
		expect(buttonContainer?.className).toContain('bg-primary-50/60');
	});
});
