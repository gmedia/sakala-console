import type { AuthOptions } from '$lib/api/resources/auth';
import type { AuthProviderId } from './utils/oauth';

export type AuthProviderOption = { id: AuthProviderId; name: string };

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

function oauthProviders(availability: AuthAvailability): AuthProviderOption[] {
	return [
		...(availability.github ? [{ id: 'github' as const, name: 'Github' }] : []),
		...(availability.google ? [{ id: 'google' as const, name: 'Google' }] : [])
	];
}

/** Password login needs no email, so an account that is already verified can always use it. */
export function loginProviders(availability: AuthAvailability): AuthProviderOption[] {
	return [...oauthProviders(availability), { id: 'email', name: 'Email' }];
}

export function registerProviders(availability: AuthAvailability): AuthProviderOption[] {
	return availability.emailDeliveryOff
		? oauthProviders(availability)
		: [...oauthProviders(availability), { id: 'email', name: 'Email' }];
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

export function loginUnavailableMessage(availability: AuthAvailability): string {
	return `${registrationUnavailableMessage(availability)} Kalau akunmu sudah terverifikasi, kamu tetap bisa masuk dengan email dan kata sandi.`;
}

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
