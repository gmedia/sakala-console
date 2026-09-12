import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { OnboardingProfile, OnboardingSource } from '$lib/api/resources/onboarding';
import {
	useCompleteOnboarding,
	useSubmitOnboardingProfile,
	useSubmitOnboardingSource
} from './mutations';

export function useOnboardingFlow() {
	let step = $state<1 | 2 | 3>(1);
	let selectedSource = $state<OnboardingSource | undefined>();
	let profileName = $state<string | undefined>();
	let profileRole = $state<OnboardingProfile | undefined>();

	const sourceMutation = useSubmitOnboardingSource();
	const profileMutation = useSubmitOnboardingProfile();
	const completeMutation = useCompleteOnboarding();

	function selectSource(source: OnboardingSource) {
		selectedSource = source;
	}

	function updateProfile(update: { name?: string; role?: OnboardingProfile }) {
		if (update.name !== undefined) profileName = update.name;
		if (update.role !== undefined) profileRole = update.role;
	}

	function submitSource() {
		if (!selectedSource) return;
		sourceMutation.mutate(
			{ type: 'source', source: selectedSource },
			{ onSuccess: () => (step = 2) }
		);
	}

	function skipSource() {
		sourceMutation.mutate({ type: 'skip' }, { onSuccess: () => (step = 2) });
	}

	function submitProfile() {
		profileMutation.mutate(
			{ name: profileName, role: profileRole },
			{ onSuccess: () => (step = 3) }
		);
	}

	function skipProfile() {
		profileMutation.mutate({ skip: true }, { onSuccess: () => (step = 3) });
	}

	function finish() {
		completeMutation.mutate(undefined, { onSuccess: () => goto(resolve('/projects')) });
	}

	function back() {
		if (step > 1) step -= 1;
	}

	return {
		get step() {
			return step;
		},
		get selectedSource() {
			return selectedSource;
		},
		get profileName() {
			return profileName;
		},
		get profileRole() {
			return profileRole;
		},
		selectSource,
		updateProfile,
		submitSource,
		skipSource,
		submitProfile,
		skipProfile,
		finish,
		back,
		sourceMutation,
		profileMutation,
		completeMutation
	};
}
