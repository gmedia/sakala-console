import { z } from 'zod';
import { apiRequest } from '../client';
import type { components } from '../generated/schema';

export type StoreFeedbackRequest = components['schemas']['StoreFeedbackRequest'];
export type FeedbackCategory = components['schemas']['FeedbackCategory'];

const feedbackResponseSchema = z.object({
	data: z.object({ id: z.union([z.string(), z.number()]), created_at: z.string().nullable() })
});

export function parseFeedbackResponse(response: unknown) {
	return feedbackResponseSchema.parse(response).data;
}

export async function submitFeedback(payload: StoreFeedbackRequest) {
	const response = await apiRequest<unknown>('/api/v1/app/feedback', {
		method: 'POST',
		json: payload
	});
	return parseFeedbackResponse(response);
}
