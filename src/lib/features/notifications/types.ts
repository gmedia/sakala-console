export type NotificationType = 'system' | 'welcome' | 'deployment' | 'alert' | 'info';

export type NotificationItem = {
	id: string;
	message: string;
	timestamp: string;
	is_read: boolean;
	type?: NotificationType;
	avatar?: string;
	link?: string;
	created_at?: string;
};

export type UnreadNotificationCount = {
	has_unread: boolean;
	unread_count: number;
};

export type UnreadNotificationCountResponse = {
	status: string;
	data: UnreadNotificationCount;
};
