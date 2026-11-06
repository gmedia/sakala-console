const STORAGE_KEY = 'sakala_session_active';

let ended = false;

function withStorage<T>(use: (storage: Storage) => T): T | undefined {
	try {
		return globalThis.localStorage ? use(globalThis.localStorage) : undefined;
	} catch {
		// Private mode can refuse storage. Then the notice only misses a session it cannot know about.
		return undefined;
	}
}

/** The browser had a session. Only then can a later 401 be called a session that ended. */
export function rememberSession(): void {
	withStorage((storage) => storage.setItem(STORAGE_KEY, '1'));
}

/** Logging out ends the session on purpose, so nothing needs explaining afterwards. */
export function forgetSession(): void {
	ended = false;
	withStorage((storage) => storage.removeItem(STORAGE_KEY));
}

/** Called on a 401. A first-time visitor had no session, so they are not told it ended. */
export function noteSessionEnded(): void {
	if (withStorage((storage) => storage.getItem(STORAGE_KEY))) ended = true;
	withStorage((storage) => storage.removeItem(STORAGE_KEY));
}

/** True once per expiry: reloading the login page does not repeat the notice. */
export function consumeSessionEndedNotice(): boolean {
	const value = ended;
	ended = false;
	return value;
}
