import type { OnboardingSource, OnboardingProfile } from '$lib/api/resources/onboarding';

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
	social_media: 'Media Sosial',
	gmedia: 'GMedia',
	github: 'GitHub',
	other: 'Lainnya'
};

export const ONBOARDING_PROFILE_VALUES = [
	'developer',
	'devops',
	'architect',
	'other'
] as const satisfies readonly OnboardingProfile[];

export const ONBOARDING_PROFILE_OPTIONS_MAP: Record<OnboardingProfile, string> = {
	developer: 'Developer',
	devops: 'DevOps',
	architect: 'Architect',
	other: 'Lainnya'
};

type AssertExhaustive<T, U extends T> = [T] extends [U] ? true : never;

const _onboardingSourceExhaustive: AssertExhaustive<
	OnboardingSource,
	(typeof ONBOARDING_SOURCE_VALUES)[number]
> = true;
void _onboardingSourceExhaustive;

const _onboardingProfileExhaustive: AssertExhaustive<
	OnboardingProfile,
	(typeof ONBOARDING_PROFILE_VALUES)[number]
> = true;
void _onboardingProfileExhaustive;

export type OnboardingSourceSelection =
	| { type: 'source'; source: OnboardingSource }
	| { type: 'skip' };

export type OnboardingProfileSelection = {
	name?: string;
	role?: OnboardingProfile;
	skip?: boolean;
};
