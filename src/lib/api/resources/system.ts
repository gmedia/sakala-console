import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type ServiceStatus = components['schemas']['ServiceStatusResource'];

type ServiceStatusResponse =
	operations['v1.status']['responses'][200]['content']['application/json'];

const serviceStatusSchema = z.object({
	service: z.string(),
	status: z.literal('ok'),
	api_version: z.string()
}) satisfies z.ZodType<ServiceStatus>;

const serviceStatusResponseSchema = z.object({
	data: serviceStatusSchema
}) satisfies z.ZodType<ServiceStatusResponse>;

export async function getServiceStatus(): Promise<ServiceStatus> {
	const response = await apiRequest<unknown>('/api/v1');

	return parseServiceStatusResponse(response);
}

export function parseServiceStatusResponse(response: unknown): ServiceStatus {
	return serviceStatusResponseSchema.parse(response).data;
}
