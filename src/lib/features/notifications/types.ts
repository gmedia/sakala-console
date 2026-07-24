export type UnreadNotificationCount = {
	has_unread: boolean;
	unread_count: number;
};

export type UnreadNotificationCountResponse = {
	status: string;
	data: UnreadNotificationCount;
};
