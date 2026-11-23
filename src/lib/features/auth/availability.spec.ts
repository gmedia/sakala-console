import { describe, expect, it } from 'vitest';
import {
	loginMethodLayout,
	LOGIN_PASSWORD_RESET_UNAVAILABLE,
	oauthProviders,
	passwordResetUnavailableMessage,
	registerOffersEmail,
	registrationUnavailableMessage,
	resolveAuthAvailability
} from './availability';

const options = (email: boolean, github = true, google = false) => ({
	isPending: false,
	data: {
		email_delivery_enabled: email,
		providers: { github, google },
		legal: {
			terms_version: 'syarat-v1',
			acceptable_use_version: 'penggunaan-wajar-v1',
			privacy_notice_version: 'privasi-v1'
		}
	}
});
const ids = (list: { id: string }[]) => list.map((provider) => provider.id);

describe('resolveAuthAvailability', () => {
	it('offers nothing that depends on the flag while it is loading', () => {
		const availability = resolveAuthAvailability({ isPending: true });

		expect(availability.isLoading).toBe(true);
		expect(availability.emailActionsAvailable).toBe(false);
		expect(availability.emailDeliveryOff).toBe(false);
	});

	it('keeps the existing behaviour when the request failed', () => {
		const availability = resolveAuthAvailability({ isPending: false });

		expect(availability.emailActionsAvailable).toBe(true);
		expect(availability.emailDeliveryOff).toBe(false);
		expect(ids(oauthProviders(availability))).toEqual(['github', 'google']);
		expect(registerOffersEmail(availability)).toBe(true);
	});

	it('hides email registration but keeps password login when delivery is off', () => {
		const availability = resolveAuthAvailability(options(false));

		expect(availability.emailActionsAvailable).toBe(false);
		expect(availability.emailDeliveryOff).toBe(true);
		expect(ids(oauthProviders(availability))).toEqual(['github']);
		expect(registerOffersEmail(availability)).toBe(false);
	});

	it('offers email and only the configured providers when delivery is on', () => {
		const availability = resolveAuthAvailability(options(true));

		expect(availability.emailActionsAvailable).toBe(true);
		expect(ids(oauthProviders(availability))).toEqual(['github']);
		expect(registerOffersEmail(availability)).toBe(true);
	});
});

describe('loginMethodLayout', () => {
	const both = resolveAuthAvailability(options(true, true, true));

	it('lists the configured providers in their usual order when nothing is remembered', () => {
		const layout = loginMethodLayout(both, null);

		expect(ids(layout.providers)).toEqual(['github', 'google']);
		expect(layout.lastUsed).toBeNull();
		expect(layout.emailFirst).toBe(false);
	});

	it('puts the provider used last first and marks it', () => {
		const layout = loginMethodLayout(both, 'google');

		expect(ids(layout.providers)).toEqual(['google', 'github']);
		expect(layout.lastUsed).toBe('google');
		expect(layout.emailFirst).toBe(false);
	});

	it('leads with the email form when email was used last', () => {
		const layout = loginMethodLayout(both, 'email');

		expect(ids(layout.providers)).toEqual(['github', 'google']);
		expect(layout.lastUsed).toBe('email');
		expect(layout.emailFirst).toBe(true);
	});

	it('ignores a remembered provider that is no longer configured', () => {
		const layout = loginMethodLayout(resolveAuthAvailability(options(true)), 'google');

		expect(ids(layout.providers)).toEqual(['github']);
		expect(layout.lastUsed).toBeNull();
	});
});

describe('the unavailable messages', () => {
	it('say plainly to use GitHub first', () => {
		const message = registrationUnavailableMessage(resolveAuthAvailability(options(false)));

		expect(message).toBe('Pendaftaran lewat email belum tersedia. Masuk lewat GitHub dulu.');
	});

	it('name only the providers that work', () => {
		const onlyGoogle = resolveAuthAvailability(options(false, false, true));
		const both = resolveAuthAvailability(options(false, true, true));

		expect(registrationUnavailableMessage(onlyGoogle)).toContain('Masuk lewat Google dulu.');
		expect(registrationUnavailableMessage(both)).toContain('GitHub atau Google');
	});

	it('do not promise a provider when none is configured', () => {
		const none = resolveAuthAvailability(options(false, false, false));

		expect(registrationUnavailableMessage(none)).not.toContain('GitHub');
		expect(registrationUnavailableMessage(none)).toContain('admin Sakala');
		expect(passwordResetUnavailableMessage(none)).not.toContain('GitHub');
	});

	it('keep the login line about the reset only, without registration or a provider', () => {
		expect(LOGIN_PASSWORD_RESET_UNAVAILABLE).toContain('Reset kata sandi');
		expect(LOGIN_PASSWORD_RESET_UNAVAILABLE).not.toContain('Pendaftaran');
		expect(LOGIN_PASSWORD_RESET_UNAVAILABLE).not.toContain('GitHub');
	});
});
