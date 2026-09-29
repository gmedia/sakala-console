import { apiRequest } from '$lib/api/client';
import type {
	Deployment,
	Project,
	UpdateProjectPayload,
	EnvironmentVariable,
	CreateEnvVarPayload,
	EnvVarValueResponse,
	TriggerRedeployPayload,
	GetDeploymentsParams,
	PaginatedDeployments
} from './type';

/**
 * Get project by ID
 */
export async function getProject(id: string): Promise<Project> {
	const res = await apiRequest<{ data: Project }>(`/api/v1/app/projects/${id}`);
	return res.data;
}

/**
 * Update project settings
 */
export async function updateProject(id: string, data: UpdateProjectPayload): Promise<Project> {
	const res = await apiRequest<{ data: Project }>(`/api/v1/app/projects/${id}`, {
		method: 'PUT',
		json: data
	});
	return res.data;
}

/**
 * Delete project
 */
export async function deleteProject(id: string): Promise<void> {
	await apiRequest<void>(`/api/v1/app/projects/${id}`, {
		method: 'DELETE'
	});
}

/**
 * Get project deployments
 */
export async function getDeployments(
	projectId: string,
	params?: GetDeploymentsParams
): Promise<PaginatedDeployments> {
	const searchParams = new URLSearchParams();
	if (params?.page) searchParams.set('page', String(params.page));
	if (params?.per_page) searchParams.set('per_page', String(params.per_page));
	if (params?.search) searchParams.set('search', params.search);
	if (params?.filter) searchParams.set('filter', params.filter);

	const query = searchParams.toString();
	const endpoint = `/api/v1/app/projects/${projectId}/deployments${query ? `?${query}` : ''}`;

	return apiRequest<PaginatedDeployments>(endpoint);
}

/**
 * Trigger a redeploy
 */
export async function triggerRedeploy(
	projectId: string,
	payload: TriggerRedeployPayload | string
): Promise<Deployment> {
	const branch = typeof payload === 'string' ? 'main' : payload.branch;
	const idempotencyKey =
		typeof payload === 'string'
			? payload
			: payload.idempotencyKey ||
				(typeof crypto !== 'undefined' && crypto.randomUUID
					? crypto.randomUUID()
					: 'deploy-' + Date.now());

	const res = await apiRequest<{ data: Deployment }>(
		`/api/v1/app/projects/${projectId}/deployments`,
		{
			method: 'POST',
			headers: {
				'Idempotency-Key': idempotencyKey
			},
			json: {
				branch
			}
		}
	);
	return res.data;
}

/**
 * Fetch list env vars
 */
export async function getEnvironmentVariables(projectId: string): Promise<EnvironmentVariable[]> {
	const res = await apiRequest<{ data: EnvironmentVariable[] }>(
		`/api/v1/app/projects/${projectId}/environment-variables`
	);
	return res.data;
}

/**
 * Add env var
 */
export async function createEnvironmentVariable(
	projectId: string,
	payload: CreateEnvVarPayload
): Promise<EnvironmentVariable> {
	const res = await apiRequest<{ data: EnvironmentVariable }>(
		`/api/v1/app/projects/${projectId}/environment-variables`,
		{
			method: 'POST',
			json: payload
		}
	);
	return res.data;
}

/**
 * Reveal env var
 */
export async function getEnvironmentVariableValue(
	projectId: string,
	envId: string
): Promise<EnvVarValueResponse> {
	return await apiRequest<EnvVarValueResponse>(
		`/api/v1/app/projects/${projectId}/environment-variables/${envId}/value`
	);
}

/**
 * Delete env var
 */
export async function deleteEnvironmentVariable(projectId: string, envId: string): Promise<void> {
	await apiRequest<void>(`/api/v1/app/projects/${projectId}/environment-variables/${envId}`, {
		method: 'DELETE'
	});
}

/**
 * Alias for backwards compatibility
 */
export const addEnvironmentVariable = (
	projectId: string,
	data: { key: string; value: string; is_secret: boolean }
) => createEnvironmentVariable(projectId, data);
