import { describe, expect, it } from 'vitest';
import {
	loginProviders,
	loginUnavailableMessage,
	passwordResetUnavailableMessage,
	registerProviders,
	registrationUnavailableMessage,
	resolveAuthAvailability
} from './availability';

const options = (email: boolean, github = true, google = false) => ({
	isPending: false,
	data: { email_delivery_enabled: email, providers: { github, google } }
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
		expect(ids(registerProviders(availability))).toEqual(['github', 'google', 'email']);
		expect(ids(loginProviders(availability))).toEqual(['github', 'google', 'email']);
	});

	it('hides email registration but keeps password login when delivery is off', () => {
		const availability = resolveAuthAvailability(options(false));

		expect(availability.emailActionsAvailable).toBe(false);
		expect(availability.emailDeliveryOff).toBe(true);
		expect(ids(registerProviders(availability))).toEqual(['github']);
		expect(ids(loginProviders(availability))).toEqual(['github', 'email']);
	});

	it('offers email and only the configured providers when delivery is on', () => {
		const availability = resolveAuthAvailability(options(true));

		expect(availability.emailActionsAvailable).toBe(true);
		expect(ids(registerProviders(availability))).toEqual(['github', 'email']);
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

	it('tell a verified account that password login still works', () => {
		const message = loginUnavailableMessage(resolveAuthAvailability(options(false)));

		expect(message).toContain('tetap bisa masuk dengan email dan kata sandi');
	});
});
