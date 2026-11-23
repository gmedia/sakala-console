import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS_TAB, settingsHref, settingsTabFrom } from './tabs';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

describe('settings tabs', () => {
	it('opens Profil when no tab, or an unknown one, is asked for', () => {
		expect(DEFAULT_SETTINGS_TAB).toBe('profile');
		expect(settingsTabFrom(null)).toBe('profile');
		expect(settingsTabFrom('keamanan')).toBe('profile');
	});

	it('keeps a known tab', () => {
		expect(settingsTabFrom('account')).toBe('account');
		expect(settingsTabFrom('notifications')).toBe('notifications');
	});

	it('links to a tab by its query parameter', () => {
		expect(settingsHref('account')).toBe('/settings?tab=account');
	});
});
