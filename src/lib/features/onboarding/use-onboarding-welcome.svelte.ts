import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { NetworkError } from '$lib/api/errors';
import {
	ONBOARDING_DESTINATIONS,
	ONBOARDING_EXAMPLES_HASH,
	type OnboardingDestination
} from './constants';
import { useCompleteOnboarding } from './mutations';

export function onboardingErrorMessage(error: unknown): string | null {
	if (!error) return null;
	if (error instanceof NetworkError) {
		return 'Sakala tidak bisa dihubungi. Periksa koneksi internet kamu, lalu coba lagi.';
	}
	return 'Sakala belum bisa menyimpan bahwa kamu sudah mulai. Coba lagi sebentar lagi.';
}

/**
 * The welcome screen finishes onboarding on its way out, because the guard keeps sending a user
 * whose onboarding is open back to it. Nothing is asked here: where someone heard of Sakala is
 * asked after their first deploy instead.
 */
export function useOnboardingWelcome() {
	const completeMutation = useCompleteOnboarding();
	let destination = $state<OnboardingDestination | null>(null);

	/** `hash` points at a section of the destination, such as the wizard's examples. */
	function leaveFor(to: OnboardingDestination, hash = '') {
		if (completeMutation.isPending) return;
		destination = to;
		completeMutation.mutate(undefined, {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a hash
			onSuccess: () => goto(`${resolve(to)}${hash}`)
		});
	}

	return {
		/** The destination being opened, while onboarding is being finished. */
		get pendingDestination() {
			return completeMutation.isPending ? destination : null;
		},
		get errorMessage() {
			return onboardingErrorMessage(completeMutation.error);
		},
		createProject: () => leaveFor(ONBOARDING_DESTINATIONS.createProject),
		/** The wizard, scrolled to the example repositories. */
		startFromExample: () =>
			leaveFor(ONBOARDING_DESTINATIONS.createProject, ONBOARDING_EXAMPLES_HASH),
		openProjects: () => leaveFor(ONBOARDING_DESTINATIONS.projects)
	};
}
