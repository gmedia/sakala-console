import { SvelteSet } from 'svelte/reactivity';
import { mockNotifications } from './fixtures';
import type { NotificationItem } from './types';

class NotificationStore {
	items = $state<NotificationItem[]>([...mockNotifications]);
	readIds = new SvelteSet<string>();

	all = $derived(
		this.items.map((item) => ({
			...item,
			is_read: item.is_read || this.readIds.has(item.id)
		}))
	);

	unreadCount = $derived(this.all.filter((item) => !item.is_read).length);
	hasUnread = $derived(this.unreadCount > 0);

	markAsRead(id: string) {
		this.readIds.add(id);
	}

	markAllAsRead() {
		for (const item of this.items) {
			this.readIds.add(item.id);
		}
	}
}

export const notificationStore = new NotificationStore();
