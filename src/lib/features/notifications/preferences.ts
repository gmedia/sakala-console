import type {
	EmailNotificationCategory,
	NotificationCategory,
	NotificationPreferences,
	NotificationPreferencesChange
} from '$lib/api/resources/notifications';

/** A change applied on top of preferences, for the optimistic update and its rollback. */
export function applyPreferencesChange(
	preferences: NotificationPreferences,
	change: NotificationPreferencesChange
): NotificationPreferences {
	const { email, ...bell } = change;
	return { ...preferences, ...bell, email: { ...preferences.email, ...email } };
}

/** The same keys as `change`, with the values `preferences` has for them. */
export function valuesForChange(
	preferences: NotificationPreferences,
	change: NotificationPreferencesChange
): NotificationPreferencesChange {
	const { email, ...bell } = change;
	const picked: NotificationPreferencesChange = Object.fromEntries(
		(Object.keys(bell) as NotificationCategory[]).map((category) => [
			category,
			preferences[category]
		])
	);
	if (email) {
		picked.email = Object.fromEntries(
			(Object.keys(email) as EmailNotificationCategory[]).map((category) => [
				category,
				preferences.email[category]
			])
		);
	}
	return picked;
}
