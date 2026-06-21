import { z } from 'zod';
import { apiRequest } from '../client';

const serviceStatusEnvelopeSchema = z.object({
	data: z.object({
		service: z.string(),
		status: z.literal('ok'),
		api_version: z.string()
	})
});

export type ServiceStatus = z.infer<typeof serviceStatusEnvelopeSchema>['data'];

export async function getServiceStatus(): Promise<ServiceStatus> {
	const response = await apiRequest<unknown>('/api/v1');
	return serviceStatusEnvelopeSchema.parse(response).data;
}
