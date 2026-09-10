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

export const ONBOARDING_OPTIONS_MAP: Record<OnboardingSource, string> = {
	campus: 'Kampus',
	friend: 'Teman',
	community: 'Komunitas',
	workshop: 'Workshop',
	social_media: 'Media Sosial',
	gmedia: 'GMedia',
	github: 'GitHub',
	other: 'Lainnya'
};

type AssertExhaustive<T, U extends T> = [T] extends [U] ? true : never;
const _onboardingSourceExhaustive: AssertExhaustive<
	OnboardingSource,
	(typeof ONBOARDING_SOURCE_VALUES)[number]
> = true;
void _onboardingSourceExhaustive;

export type OnboardingSelection = { type: 'source'; source: OnboardingSource } | { type: 'skip' };
