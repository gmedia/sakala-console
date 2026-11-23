import type { AuthOptions } from '$lib/api/resources/auth';
import type { AuthProviderId } from './utils/oauth';

export type OAuthProviderId = Exclude<AuthProviderId, 'email'>;
export type AuthProviderOption = { id: OAuthProviderId; name: string };

export type AuthAvailability = {
	/** The API has not answered yet, so no option may be shown or hidden based on it. */
	isLoading: boolean;
	/** Email-based actions can be offered. A failed fetch keeps them: the API still has the last word. */
	emailActionsAvailable: boolean;
	/** The API said email cannot be delivered. */
	emailDeliveryOff: boolean;
	github: boolean;
	google: boolean;
};

export function resolveAuthAvailability(query: {
	isPending: boolean;
	data?: AuthOptions;
}): AuthAvailability {
	const delivery = query.data?.email_delivery_enabled;

	return {
		isLoading: query.isPending,
		emailActionsAvailable: !query.isPending && delivery !== false,
		emailDeliveryOff: delivery === false,
		github: query.data?.providers.github ?? true,
		google: query.data?.providers.google ?? true
	};
}

/** The OAuth providers the API has configured, in the order the auth screens list them. */
export function oauthProviders(availability: AuthAvailability): AuthProviderOption[] {
	return [
		...(availability.github ? [{ id: 'github' as const, name: 'GitHub' }] : []),
		...(availability.google ? [{ id: 'google' as const, name: 'Google' }] : [])
	];
}

export type LoginMethodLayout = {
	/** OAuth providers in display order, the one used last on this browser first. */
	providers: AuthProviderOption[];
	/** The method that gets "Terakhir dipakai", or null when the remembered one is not offered. */
	lastUsed: AuthProviderId | null;
	/** The email form leads when it was the method used last. */
	emailFirst: boolean;
};

/**
 * Every login method shows at once. Password login needs no email delivery, so an account that is
 * already verified can always use it; a remembered provider that is no longer configured is
 * ignored rather than offered.
 */
export function loginMethodLayout(
	availability: AuthAvailability,
	remembered: AuthProviderId | null
): LoginMethodLayout {
	const providers = oauthProviders(availability);
	const lastUsed =
		remembered === 'email' || providers.some((provider) => provider.id === remembered)
			? remembered
			: null;

	return {
		providers: [...providers].sort((a, b) => Number(b.id === lastUsed) - Number(a.id === lastUsed)),
		lastUsed,
		emailFirst: lastUsed === 'email'
	};
}

/** Registering with a password sends a verification email, so it needs delivery to be on. */
export function registerOffersEmail(availability: AuthAvailability): boolean {
	return !availability.emailDeliveryOff;
}

/** The sentence that says where to go instead, naming only providers that really work. */
function nextStep(availability: AuthAvailability, fallback: string): string {
	if (availability.github && availability.google) return 'Masuk lewat GitHub atau Google dulu.';
	if (availability.github) return 'Masuk lewat GitHub dulu.';
	if (availability.google) return 'Masuk lewat Google dulu.';
	return fallback;
}

export function registrationUnavailableMessage(availability: AuthAvailability): string {
	const next = nextStep(availability, 'Hubungi admin Sakala untuk mendapatkan akses.');
	return `Pendaftaran lewat email belum tersedia. ${next}`;
}

/**
 * The login page's one line about email delivery, where "Lupa kata sandi?" would be. Logging in
 * with a password needs no email; only a reset does. It names no provider: an account made with a
 * password cannot sign in through GitHub or Google with the same email.
 */
export const LOGIN_PASSWORD_RESET_UNAVAILABLE =
	'Reset kata sandi lewat email belum tersedia. Kalau lupa kata sandi, hubungi admin Sakala.';

export function passwordResetUnavailableMessage(availability: AuthAvailability): string {
	const next = nextStep(availability, 'Hubungi admin Sakala kalau kamu butuh bantuan.');
	return `Sakala belum bisa mengirim email, jadi tautan reset kata sandi belum tersedia. ${next}`;
}

export function verificationUnavailableMessage(availability: AuthAvailability): string {
	const next = nextStep(availability, 'Hubungi admin Sakala kalau kamu butuh bantuan.');
	return `Sakala belum bisa mengirim email, jadi tautan verifikasi baru belum tersedia. ${next}`;
}

export const EMAIL_CHANGE_UNAVAILABLE_MESSAGE =
	'Ganti email belum tersedia, karena Sakala belum bisa mengirim email konfirmasi ke alamat baru. Email akunmu tetap seperti yang tertulis di atas.';
