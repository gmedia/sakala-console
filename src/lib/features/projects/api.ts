import { mockDeployments, mockProjects } from './mock';
import type { Deployment, Project, UpdateProjectPayload } from './type';

/**
 * Mock delay to simulate network latency
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get project by ID
 */
export async function getProject(id: string): Promise<Project> {
	await delay(400);
	const project = mockProjects.find((p) => p.id === id);
	if (!project) throw new Error('Project not found');
	return project;
}

/**
 * Update project settings
 */
export async function updateProject(id: string, data: UpdateProjectPayload): Promise<Project> {
	await delay(800);
	const project = mockProjects.find((p) => p.id === id);
	if (!project) throw new Error('Project not found');

	// Create a new updated object
	const updated = {
		...project,
		...data,
		updated_at: new Date().toISOString()
	};

	return updated as Project;
}

/**
 * Delete project
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function deleteProject(id: string): Promise<void> {
	await delay(1000);
}

/**
 * Get project deployments
 */
export async function getDeployments(projectId: string): Promise<Deployment[]> {
	await delay(500);
	return mockDeployments.filter((d) => d.project_id === projectId);
}

/**
 * Trigger a redeploy
 */
export async function triggerRedeploy(
	projectId: string,
	idempotencyKey: string
): Promise<Deployment> {
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
