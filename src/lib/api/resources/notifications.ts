import { z } from 'zod';
import { apiRequest } from '../client';

/**
 * Written from NotificationResource in sakala-api rather than `satisfies` the generated type:
 * Scramble loses the nullable fields and types `count` as a string.
 */
const notificationSchema = z.object({
	id: z.string(),
	category: z.string().nullable(),
	title: z.string().nullable(),
	message: z.string().nullable(),
	project_id: z.string().nullable(),
	deployment_id: z.string().nullable(),
	/** The invitation a `workspace` notification is about. Older notifications lack the field. */
	invitation_id: z.string().nullable().default(null),
	/** The team a `workspace` notification is about, while the recipient still belongs to it. */
	workspace_id: z.string().nullable().default(null),
	read_at: z.string().nullable(),
	created_at: z.string().nullable()
});

export type Notification = z.infer<typeof notificationSchema>;

const notificationPageSchema = z.object({
	data: z.array(notificationSchema),
	meta: z.object({
		current_page: z.number(),
		last_page: z.number(),
		total: z.number()
	})
});

export type NotificationPage = z.infer<typeof notificationPageSchema>;

export type NotificationListParams = {
	page?: number;
	perPage?: number;
	unreadOnly?: boolean;
};

export async function listNotifications(
	params: NotificationListParams = {}
): Promise<NotificationPage> {
	const response = await apiRequest<unknown>('api/v1/app/notifications', {
		params: {
			page: params.page,
			per_page: params.perPage,
			// Laravel's boolean rule rejects the string "true".
			unread: params.unreadOnly ? 1 : undefined
		}
	});
	return notificationPageSchema.parse(response);
}

const unreadCountResponseSchema = z.object({
	data: z.object({ count: z.number() })
});

export async function getUnreadNotificationCount(): Promise<number> {
	const response = await apiRequest<unknown>('api/v1/app/notifications/unread-count');
	return unreadCountResponseSchema.parse(response).data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
	await apiRequest<unknown>(`api/v1/app/notifications/${encodeURIComponent(id)}/read`, {
		method: 'POST'
	});
}

export async function markAllNotificationsRead(): Promise<void> {
	await apiRequest<void>('api/v1/app/notifications/read-all', { method: 'POST' });
}

/**
 * Written from NotificationPreferenceResource in sakala-api: the generated OpenAPI types predate
 * the `workspace` category.
 */
const notificationPreferencesSchema = z.object({
	deployment_success: z.boolean(),
	deployment_failure: z.boolean(),
	project_issue: z.boolean(),
	account_security: z.boolean(),
	/**
	 * Team invitations and membership changes. Invitation emails are sent regardless. On by
	 * default in the API, which is also what an API that does not return it yet has stored.
	 */
	workspace: z.boolean().default(true)
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

const preferencesResponseSchema = z.object({ data: notificationPreferencesSchema });

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
	const response = await apiRequest<unknown>('api/v1/app/notification-preferences');
	return preferencesResponseSchema.parse(response).data;
}

export async function updateNotificationPreferences(
	changes: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
	const response = await apiRequest<unknown>('api/v1/app/notification-preferences', {
		method: 'PATCH',
		json: changes
	});
	return preferencesResponseSchema.parse(response).data;
}
