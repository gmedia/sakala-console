import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

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
}) satisfies z.ZodType<components['schemas']['NotificationResource']>;

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
}) satisfies z.ZodType<{ data: components['schemas']['UnreadNotificationCountResource'] }>;

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

/** The categories sakala-api can email (`email` in NotificationPreferenceResource, gmedia/sakala-api#177). */
export const EMAIL_NOTIFICATION_CATEGORIES = [
	'deployment_success',
	'deployment_failure',
	'project_issue'
] as const;

export type EmailNotificationCategory = (typeof EMAIL_NOTIFICATION_CATEGORIES)[number];

/**
 * The API's defaults: email for failures and app problems, the bell only for a success. An API
 * from before email notifications sends no `email`, and these are what it would have stored.
 */
const EMAIL_DEFAULTS: Record<EmailNotificationCategory, boolean> = {
	deployment_success: false,
	deployment_failure: true,
	project_issue: true
};

/** Written from NotificationPreferenceResource in sakala-api, which stays the final check. */
const notificationPreferencesSchema = z.object({
	deployment_success: z.boolean(),
	deployment_failure: z.boolean(),
	project_issue: z.boolean(),
	account_security: z.boolean(),
	/**
	 * Team invitations and membership changes. Invitation emails are sent regardless. On by
	 * default in the API, which is also what an API that does not return it yet has stored.
	 */
	workspace: z.boolean().default(true),
	email: z
		.object({
			deployment_success: z.boolean(),
			deployment_failure: z.boolean(),
			project_issue: z.boolean()
		})
		.default(EMAIL_DEFAULTS)
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;
/** The bell categories: every flat boolean. */
export type NotificationCategory = Exclude<keyof NotificationPreferences, 'email'>;

/** `PATCH` takes any part of either channel. */
export type NotificationPreferencesChange = Partial<Omit<NotificationPreferences, 'email'>> & {
	email?: Partial<NotificationPreferences['email']>;
};

const preferencesResponseSchema = z.object({ data: notificationPreferencesSchema });

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
	const response = await apiRequest<unknown>('api/v1/app/notification-preferences');
	return preferencesResponseSchema.parse(response).data;
}

export async function updateNotificationPreferences(
	changes: NotificationPreferencesChange
): Promise<NotificationPreferences> {
	const response = await apiRequest<unknown>('api/v1/app/notification-preferences', {
		method: 'PATCH',
		json: changes
	});
	return preferencesResponseSchema.parse(response).data;
}

const unsubscribeResponseSchema = z.object({
	data: z.object({ category: z.string(), email: z.literal(false) })
});

/**
 * Turns off one email category from a signed link, without a session. `search` is the link's
 * query string exactly as the page received it, `?` included: the signature covers it byte for
 * byte, so nothing here parses or rebuilds it. Sent without cookies or CSRF, as the route expects.
 */
export async function unsubscribeFromNotificationEmail(search: string): Promise<string> {
	const response = await apiRequest<unknown>(`api/v1/public/notifications/unsubscribe${search}`, {
		method: 'POST',
		anonymous: true
	});
	return unsubscribeResponseSchema.parse(response).data.category;
}
