import { describe, expect, it } from 'vitest';
import {
	EMAIL_CHANGED_CONTENT,
	EMAIL_VERIFIED_CONTENT,
	parseEmailLinkStatus,
	type AuthStatusContent
} from './email-link-status';

/** Sentences in a text: a stop followed by more text starts the next one. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=\S)/).length;

describe('parseEmailLinkStatus', () => {
	it('accepts only what the API sends', () => {
		expect(parseEmailLinkStatus('success')).toBe('success');
		expect(parseEmailLinkStatus('error')).toBe('error');
	});

	it.each([null, '', 'SUCCESS', 'ok', '<script>'])('treats %s as unknown', (value) => {
		expect(parseEmailLinkStatus(value)).toBe('unknown');
	});
});

describe('the email link screens', () => {
	const screens: [string, AuthStatusContent][] = [
		...Object.entries(EMAIL_VERIFIED_CONTENT).map(
			([status, content]): [string, AuthStatusContent] => [`verified ${status}`, content]
		),
		...Object.entries(EMAIL_CHANGED_CONTENT).map(
			([status, content]): [string, AuthStatusContent] => [`changed ${status}`, content]
		)
	];

	it.each(screens)('say one sentence for %s (docs/UI_GUIDELINES.md)', (_name, content) => {
		expect(sentences(content.description)).toBe(1);
	});
});
