import { describe, expect, it } from 'vitest';
import { apiErrorFromResponse } from '$lib/api/errors';
import {
	CONSENT_REQUIRED_MESSAGE,
	isOutdatedLegalVersion,
	legalConsentError
} from './legal-consent';

const refused = (field: string) =>
	apiErrorFromResponse(422, { errors: { [field]: ['Nilai tidak dikenal.'] } });

describe('a refused acceptance', () => {
	it.each(['terms_version', 'acceptable_use_version'])(
		'treats a wrong %s as a document that changed, not as a mistake',
		(field) => {
			expect(isOutdatedLegalVersion(refused(field))).toBe(true);
			expect(legalConsentError(refused(field))).toMatch(/baru saja diperbarui/);
		}
	);

	it('asks for the box when the box is what the API refused', () => {
		expect(isOutdatedLegalVersion(refused('accept_terms'))).toBe(false);
		expect(legalConsentError(refused('accept_terms'))).toBe(CONSENT_REQUIRED_MESSAGE);
	});

	it('stays out of errors about other fields', () => {
		expect(legalConsentError(refused('email'))).toBeUndefined();
		expect(legalConsentError(apiErrorFromResponse(500))).toBeUndefined();
	});
});
