import { createMutation } from '@tanstack/svelte-query';
import { submitFeedback, type StoreFeedbackRequest } from '$lib/api/resources/feedback';

export function createSubmitFeedbackMutation() {
	return createMutation(() => ({
		mutationFn: (payload: StoreFeedbackRequest) => submitFeedback(payload)
	}));
}
