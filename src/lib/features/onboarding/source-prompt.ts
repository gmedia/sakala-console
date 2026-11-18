/**
 * "Dari mana kamu tahu Sakala?" is asked once, after a first deploy goes live, and never blocks
 * anything. Answering stores it on the account through `POST onboarding/source`, which takes an
 * answer whether or not onboarding is finished. Skipping is remembered on this browser only: the
 * API has no field for "asked and declined", and `skip` there only clears the answer.
 */

type PromptStorage = Pick<Storage, 'getItem' | 'setItem'>;

const DISMISSED_KEY_PREFIX = 'onboarding_source_prompt_dismissed:';
const DISMISSED_VALUE = '1';

export function sourcePromptDismissedKey(userId: number | string): string {
	return `${DISMISSED_KEY_PREFIX}${userId}`;
}

export function browserPromptStorage(): PromptStorage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function isSourcePromptDismissed(
	storage: PromptStorage | null,
	userId: number | string
): boolean {
	try {
		return storage?.getItem(sourcePromptDismissedKey(userId)) === DISMISSED_VALUE;
	} catch {
		return false;
	}
}

export function dismissSourcePrompt(storage: PromptStorage | null, userId: number | string): void {
	try {
		storage?.setItem(sourcePromptDismissedKey(userId), DISMISSED_VALUE);
	} catch {
		// Storage can be full or blocked; the prompt then shows again next time, which is harmless.
	}
}

/** Only someone who has not answered yet and has not waved it away on this browser is asked. */
export function shouldAskSource(
	user: { id: number | string; onboarding_source: string | null } | undefined,
	storage: PromptStorage | null
): boolean {
	if (!user || user.onboarding_source) return false;
	return !isSourcePromptDismissed(storage, user.id);
}
