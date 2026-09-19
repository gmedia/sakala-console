import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import {
	submitOnboardingSource,
	submitOnboardingProfile,
	submitOnboardingCompleted
} from '$lib/api/resources/onboarding';
import { queryKeys } from '$lib/api/query-keys';
import type { OnboardingSourceSelection, OnboardingProfileSelection } from './constants';

const SOURCE_SKIP_VALUE = true;

export function useSubmitOnboardingSource() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (selection: OnboardingSourceSelection) => {
			const payload =
				selection.type === 'source' ? { source: selection.source } : { skip: SOURCE_SKIP_VALUE };
			return submitOnboardingSource(payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser });
		}
	}));
}

export function useSubmitOnboardingProfile() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: (selection: OnboardingProfileSelection) => submitOnboardingProfile(selection),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser });
		}
	}));
}

export function useCompleteOnboarding() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: () => submitOnboardingCompleted(),
		onSuccess: (user) => {
			queryClient.setQueryData(queryKeys.auth.currentUser, user);

			queryClient.invalidateQueries({
				queryKey: queryKeys.auth.currentUser
			});
		}
	}));
}
