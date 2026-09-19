import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { OnboardingProfile, OnboardingSource } from '$lib/api/resources/onboarding';
import {
	useCompleteOnboarding,
	useSubmitOnboardingProfile,
	useSubmitOnboardingSource
} from './mutations';
import { ApiError, NetworkError } from '$lib/api/errors';

function toErrorMessage(error: unknown): string | null {
	if (!error) return null;
	if (error instanceof NetworkError)
		return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.';
	if (error instanceof ApiError && error.isValidationError) {
		return 'Data yang dikirim tidak valid. Silakan periksa kembali.';
	}
	return 'Gagal menyimpan, silakan coba lagi.';
}

export function useOnboardingFlow() {
	let step = $state<1 | 2 | 3>(1);
	let selectedSource = $state<OnboardingSource | undefined>();
	let profileName = $state<string | undefined>();
	let profileRole = $state<OnboardingProfile | undefined>();

	const sourceMutation = useSubmitOnboardingSource();
	const profileMutation = useSubmitOnboardingProfile();
	const completeMutation = useCompleteOnboarding();

	const isSubmittingSource = $derived(
		sourceMutation.isPending && sourceMutation.variables?.type === 'source'
	);

	const isSkippingSource = $derived(
		sourceMutation.isPending && sourceMutation.variables?.type === 'skip'
	);

	const isSubmittingProfile = $derived(
		profileMutation.isPending && !profileMutation.variables?.skip
	);

	const isSkippingProfile = $derived(
		profileMutation.isPending && profileMutation.variables?.skip === true
	);

	const sourceErrorMessage = $derived(toErrorMessage(sourceMutation.error));
	const profileErrorMessage = $derived(toErrorMessage(profileMutation.error));
	const completeErrorMessage = $derived(toErrorMessage(completeMutation.error));

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
		const name = profileName?.trim();

		if (!name || !profileRole) return;
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
		get isSubmittingSource() {
			return isSubmittingSource;
		},
		get isSkippingSource() {
			return isSkippingSource;
		},
		get isSubmittingProfile() {
			return isSubmittingProfile;
		},
		get isSkippingProfile() {
			return isSkippingProfile;
		},
		get sourceErrorMessage() {
			return sourceErrorMessage;
		},
		get profileErrorMessage() {
			return profileErrorMessage;
		},
		get completeErrorMessage() {
			return completeErrorMessage;
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
