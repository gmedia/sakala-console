import { createMutation, useQueryClient } from '@tanstack/svelte-query';
import { submitOnboardingSource } from '$lib/api/resources/onboarding';
import { queryKeys } from '$lib/api/query-keys';
import type { OnboardingSelection } from './constants';

const SKIP_VALUE = 'true';

export function useSubmitOnboarding() {
	const queryClient = useQueryClient();

	return createMutation(() => ({
		mutationFn: async (selection: OnboardingSelection) => {
			const payload =
				selection.type === 'source' ? { source: selection.source } : { skip: SKIP_VALUE };
			return await submitOnboardingSource(payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.auth.currentUser });
		}
	}));
}
