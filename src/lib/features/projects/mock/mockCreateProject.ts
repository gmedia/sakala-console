import type { CreateProjectPayload, CreateProjectResult } from '../type';

function generateBackendSlug(text: string) {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\w-]+/g, '')
		.replace(/--+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

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

	const slug = generateBackendSlug(payload.project_name);
	const generatedDomain = `${slug}.run.sakala.dev`;

	return {
		id: crypto.randomUUID(),
		project_name: payload.project_name,
		domain: generatedDomain
	};
}
