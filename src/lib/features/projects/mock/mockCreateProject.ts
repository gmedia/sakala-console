import type { CreateProjectPayload, CreateProjectResult } from '../type';

export async function mockCreateProject(
	payload: CreateProjectPayload
): Promise<CreateProjectResult> {
	await new Promise((resolve) => setTimeout(resolve, 1000));

	if (!payload.project_name.trim()) {
		throw new Error('Project name is required.');
	}
	if (!payload.repository_url.trim()) {
		throw new Error('Repository URL is required.');
	}
	if (!payload.branch.trim()) {
		throw new Error('Branch is required.');
	}

	return {
		id: crypto.randomUUID(),
		project_name: payload.project_name
	};
}
