import { apiRequest } from '$lib/api/client';
import { mockDeployments, mockProjects, mockEnvironmentVariables } from './mock';
import type {
	Deployment,
	Project,
	UpdateProjectPayload,
	EnvironmentVariable,
	CreateEnvVarPayload,
	EnvVarValueResponse,
	ProjectEnvironmentVariable
} from './type';

/**
 * Mock delay to simulate network latency
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get project by ID
 */
export async function getProject(id: string): Promise<Project> {
	try {
		const res = await apiRequest<{ data: Project }>(`/api/v1/app/projects/${id}`);
		return res.data;
	} catch (error) {
		const project = mockProjects.find((p) => p.id === id);
		if (project) return project;
		throw error;
	}
}

/**
 * Update project settings
 */
export async function updateProject(id: string, data: UpdateProjectPayload): Promise<Project> {
	try {
		const res = await apiRequest<{ data: Project }>(`/api/v1/app/projects/${id}`, {
			method: 'PUT',
			json: data
		});
		return res.data;
	} catch (error) {
		const project = mockProjects.find((p) => p.id === id);
		if (project) {
			const updated = {
				...project,
				...(data.name ? { project_name: data.name, name: data.name } : {}),
				...(data.branch ? { branch: data.branch } : {}),
				...(data.thumbnail_url !== undefined ? { thumbnail_url: data.thumbnail_url } : {}),
				updated_at: new Date().toISOString()
			};
			return updated as Project;
		}
		throw error;
	}
}

/**
 * Delete project
 */
export async function deleteProject(id: string): Promise<void> {
	try {
		await apiRequest<void>(`/api/v1/app/projects/${id}`, {
			method: 'DELETE'
		});
	} catch {
		const idx = mockProjects.findIndex((p) => p.id === id);
		if (idx !== -1) {
			mockProjects.splice(idx, 1);
		}
	}
}

/**
 * Get project deployments
 */
export async function getDeployments(projectId: string): Promise<Deployment[]> {
	try {
		const res = await apiRequest<{ data: Deployment[] }>(
			`/api/v1/app/projects/${projectId}/deployments`
		);
		return res.data;
	} catch {
		await delay(500);
		return mockDeployments.filter((d) => d.project_id === projectId);
	}
}

/**
 * Trigger a redeploy
 */
export async function triggerRedeploy(
	projectId: string,
	idempotencyKey: string
): Promise<Deployment> {
	try {
		const res = await apiRequest<{ data: Deployment }>(
			`/api/v1/app/projects/${projectId}/deployments`,
			{
				method: 'POST',
				headers: {
					'Idempotency-Key': idempotencyKey
				}
			}
		);
		return res.data;
	} catch {
		await delay(800);
		console.log(`Triggering redeploy with Idempotency-Key: ${idempotencyKey}`);

		const isRunning = mockDeployments.some(
			(d) => d.project_id === projectId && ['queued', 'building', 'running'].includes(d.status)
		);

		if (isRunning) {
			throw new Error('Deployment sedang berjalan. Harap tunggu hingga selesai.');
		}

		return mockDeployments[0];
	}
}

/**
 * Fetch list env vars
 */
export async function getEnvironmentVariables(projectId: string): Promise<EnvironmentVariable[]> {
	try {
		const res = await apiRequest<{ data: EnvironmentVariable[] }>(
			`/api/v1/app/projects/${projectId}/environment-variables`
		);
		return res.data;
	} catch (error) {
		const mockVars = mockEnvironmentVariables.filter((e) => e.project_id === projectId);
		if (mockVars.length > 0) {
			return mockVars;
		}
		throw error;
	}
}

/**
 * Add env var
 */
export async function createEnvironmentVariable(
	projectId: string,
	payload: CreateEnvVarPayload
): Promise<EnvironmentVariable> {
	try {
		const res = await apiRequest<{ data: EnvironmentVariable }>(
			`/api/v1/app/projects/${projectId}/environment-variables`,
			{
				method: 'POST',
				json: payload
			}
		);
		return res.data;
	} catch {
		const newVar: ProjectEnvironmentVariable = {
			id: 'env_' + Math.random().toString(36).substring(7),
			project_id: projectId,
			key: payload.key,
			value: payload.value,
			is_secret: payload.is_secret,
			created_at: new Date().toISOString()
		};
		mockEnvironmentVariables.push(newVar);
		return newVar;
	}
}

/**
 * Reveal env var
 */
export async function getEnvironmentVariableValue(
	projectId: string,
	envId: string
): Promise<EnvVarValueResponse> {
	try {
		return await apiRequest<EnvVarValueResponse>(
			`/api/v1/app/projects/${projectId}/environment-variables/${envId}/value`
		);
	} catch (error) {
		const mock = mockEnvironmentVariables.find((e) => e.id === envId);
		if (mock && mock.value) {
			return { data: { value: mock.value } };
		}
		throw error;
	}
}

/**
 * Delete env var
 */
export async function deleteEnvironmentVariable(projectId: string, envId: string): Promise<void> {
	try {
		await apiRequest<void>(`/api/v1/app/projects/${projectId}/environment-variables/${envId}`, {
			method: 'DELETE'
		});
	} catch {
		const index = mockEnvironmentVariables.findIndex(
			(e) => e.id === envId && e.project_id === projectId
		);
		if (index !== -1) {
			mockEnvironmentVariables.splice(index, 1);
		}
	}
}

/**
 * Alias for backwards compatibility
 */
export const addEnvironmentVariable = (
	projectId: string,
	data: { key: string; value: string; is_secret: boolean }
) => createEnvironmentVariable(projectId, data);
