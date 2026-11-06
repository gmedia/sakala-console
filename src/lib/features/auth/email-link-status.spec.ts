import { describe, expect, it } from 'vitest';
import { parseEmailLinkStatus } from './email-link-status';

describe('parseEmailLinkStatus (U-06)', () => {
	it('accepts only what the API sends', () => {
		expect(parseEmailLinkStatus('success')).toBe('success');
		expect(parseEmailLinkStatus('error')).toBe('error');
	});

	it.each([null, '', 'SUCCESS', 'ok', '<script>'])('treats %s as unknown', (value) => {
		expect(parseEmailLinkStatus(value)).toBe('unknown');
	});
});
