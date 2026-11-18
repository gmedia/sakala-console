import { describe, expect, it } from 'vitest';
import {
	dismissSourcePrompt,
	isSourcePromptDismissed,
	shouldAskSource,
	sourcePromptDismissedKey
} from './source-prompt';

function memoryStorage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value)
	};
}

describe('shouldAskSource', () => {
	it('asks a user who has not answered', () => {
		expect(shouldAskSource({ id: 1, onboarding_source: null }, memoryStorage())).toBe(true);
	});

	it('does not ask a user who answered, or before the user is known', () => {
		expect(shouldAskSource({ id: 1, onboarding_source: 'campus' }, memoryStorage())).toBe(false);
		expect(shouldAskSource(undefined, memoryStorage())).toBe(false);
	});

	it('does not ask again on a browser where it was skipped, per user', () => {
		const storage = memoryStorage();
		dismissSourcePrompt(storage, 1);

		expect(isSourcePromptDismissed(storage, 1)).toBe(true);
		expect(shouldAskSource({ id: 1, onboarding_source: null }, storage)).toBe(false);
		expect(shouldAskSource({ id: 2, onboarding_source: null }, storage)).toBe(true);
	});

	it('still asks when storage is missing or refuses', () => {
		const refusing = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};

		expect(shouldAskSource({ id: 1, onboarding_source: null }, null)).toBe(true);
		expect(() => dismissSourcePrompt(refusing, 1)).not.toThrow();
		expect(shouldAskSource({ id: 1, onboarding_source: null }, refusing)).toBe(true);
	});

	it('keys the skip by user', () => {
		expect(sourcePromptDismissedKey(42)).toBe('onboarding_source_prompt_dismissed:42');
	});
});
