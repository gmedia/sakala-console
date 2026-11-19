import type { OnboardingSource } from '$lib/api/resources/onboarding';

export const ONBOARDING_SOURCE_VALUES = [
	'campus',
	'friend',
	'community',
	'workshop',
	'social_media',
	'gmedia',
	'github',
	'other'
] as const satisfies readonly OnboardingSource[];

export const ONBOARDING_SOURCE_OPTIONS_MAP: Record<OnboardingSource, string> = {
	campus: 'Kampus',
	friend: 'Teman',
	community: 'Komunitas',
	workshop: 'Workshop',
	social_media: 'Media sosial',
	gmedia: 'GMEDIA',
	github: 'GitHub',
	other: 'Lainnya'
};

type AssertExhaustive<T, U extends T> = [T] extends [U] ? true : never;

const _onboardingSourceExhaustive: AssertExhaustive<
	OnboardingSource,
	(typeof ONBOARDING_SOURCE_VALUES)[number]
> = true;
void _onboardingSourceExhaustive;

export type OnboardingSourceSelection =
	{ type: 'source'; source: OnboardingSource } | { type: 'skip' };

/** Where a new user goes from the welcome screen: the wizard, or the project list to look around. */
export const ONBOARDING_DESTINATIONS = {
	createProject: '/projects/new',
	projects: '/projects'
} as const;

/** The section of the wizard that lists the example repositories (`StarterExamples`). */
export const ONBOARDING_EXAMPLES_HASH = '#contoh';

export type OnboardingDestination =
	(typeof ONBOARDING_DESTINATIONS)[keyof typeof ONBOARDING_DESTINATIONS];
