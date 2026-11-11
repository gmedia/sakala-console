import { describe, expect, test } from 'vitest';
import { getOnboardingRedirect } from './onboarding-redirect';

describe('getOnboardingRedirect', () => {
	test('sends someone who has not finished onboarding there from any app page', () => {
		expect(getOnboardingRedirect({ onboarding_completed_at: null }, '/projects')).toBe(
			'/onboarding'
		);
		expect(getOnboardingRedirect({}, '/projects/new')).toBe('/onboarding');
	});

	test('lets onboarding render for someone who has not finished it', () => {
		expect(getOnboardingRedirect({ onboarding_completed_at: null }, '/onboarding')).toBeNull();
	});

	test('sends someone who finished onboarding away from it', () => {
		expect(
			getOnboardingRedirect({ onboarding_completed_at: '2026-01-01T00:00:00+00:00' }, '/onboarding')
		).toBe('/projects');
	});

	test('lets app pages render once onboarding is finished', () => {
		expect(
			getOnboardingRedirect({ onboarding_completed_at: '2026-01-01T00:00:00+00:00' }, '/projects')
		).toBeNull();
	});
});
