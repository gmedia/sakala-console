import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';
import { workspaceSummarySchema, type WorkspaceSummary } from './workspaces';

export type GeneratedProject = components['schemas']['GetCollectionProjectResource'];
export type Project = Omit<GeneratedProject, 'runtime_status'> & {
	runtime_status: string;
	/** The owning workspace. Optional because an API from before workspaces does not send it. */
	workspace?: WorkspaceSummary | null;
};
export type RuntimeStatus = components['schemas']['RuntimeStatus'];

type GeneratedProjectResponse =
	operations['projects.index']['responses'][200]['content']['application/json'];
export type ProjectResponse = Omit<GeneratedProjectResponse, 'data'> & {
	data: Project[];
};
/** Without `workspace_id` the API lists the projects of every workspace the user belongs to. */
export type ProjectsQueryParams = NonNullable<
	operations['projects.index']['parameters']['query']
> & {
	workspace_id?: string;
};

const projectSchema: z.ZodType<Project> = z.object({
	id: z.string(),
	name: z.string(),
	repository_full_name: z.string().nullable(),
	repository_source: z.enum(['public_url', 'github_installation']),
	github_installation_id: z.string().nullable(),
	github_repository_id: z.number().nullable(),
	branch: z.string(),
	thumbnail_url: z.string().nullable(),
	public_url: z.string(),
	runtime_status: z.string(),
	suspension: z
		.object({
			reason: z.string().nullable(),
			suspended_at: z.string().nullable()
		})
		.nullable(),
	latest_deployment: z
		.object({
			id: z.string(),
			sequence: z.number(),
			status: z.string(),
			branch: z.string(),
			commit_sha: z.string().nullable(),
			commit_message: z.string().nullable(),
			created_at: z.string(),
			finished_at: z.string().nullable()
		})
		.nullable(),
	stack: z
		.object({
			builder: z.enum(['dockerfile', 'railpack']),
			provider: z.string().nullable(),
			framework: z.string().nullable(),
			package_manager: z.string().nullable()
		})
		.nullable(),
	last_deployed_at: z.string().nullable(),
	created_at: z.string(),
	workspace: workspaceSummarySchema.nullable().optional()
});

const paginationLinkSchema = z.object({
	url: z.string().nullable(),
	label: z.string(),
	active: z.boolean()
});

const paginationLinksSchema = z.object({
	first: z.string().nullable(),
	last: z.string().nullable(),
	prev: z.string().nullable(),
	next: z.string().nullable()
});

const paginationMetaSchema = z.object({
	current_page: z.number(),
	from: z.number().nullable(),
	last_page: z.number(),
	links: z.array(paginationLinkSchema),
	path: z.string().nullable(),
	per_page: z.number(),
	to: z.number().nullable(),
	total: z.number()
});

const listProjectsResponseSchema: z.ZodType<ProjectResponse> = z.object({
	data: z.array(projectSchema),
	links: paginationLinksSchema,
	meta: paginationMetaSchema
});

export async function getListProjects(params: ProjectsQueryParams): Promise<ProjectResponse> {
	const response = await apiRequest<unknown>('/api/v1/app/projects', { params });
	return parseListProjectsResponse(response);
}

export function parseListProjectsResponse(response: unknown): ProjectResponse {
	return listProjectsResponseSchema.parse(response);
}

/** Without `workspace_id` the project goes to the caller's personal workspace. */
export type StoreProjectRequest = components['schemas']['StoreProjectRequest'] & {
	workspace_id?: string | null;
};

export type CreateProjectResource = {
	id: string;
	name: string;
	repository_full_name: string | null;
	repository_source: 'public_url' | 'github_installation';
	github_installation_id: string | null;
	github_repository_id: number | null;
	branch: string;
	runtime_status: string;
	preview_status?: string;
	workspace?: WorkspaceSummary | null;
	created_at: string;
};

export const createProjectResourceSchema: z.ZodType<CreateProjectResource> = z.object({
	id: z.string(),
	name: z.string(),
	repository_full_name: z.string().nullable().default(null),
	repository_source: z.enum(['public_url', 'github_installation']),
	github_installation_id: z.string().nullable().default(null),
	github_repository_id: z
		.union([z.number(), z.string()])
		.transform((val) => (val === null || val === undefined ? null : Number(val)))
		.nullable()
		.default(null),
	branch: z.string(),
	runtime_status: z.string(),
	preview_status: z.string().optional(),
	workspace: workspaceSummarySchema.nullable().optional(),
	created_at: z.string()
});

const createProjectResponseSchema = z.object({
	data: createProjectResourceSchema
});

export function parseCreateProjectResponse(response: unknown): CreateProjectResource {
	return createProjectResponseSchema.parse(response).data;
}

export async function createProject(payload: StoreProjectRequest): Promise<CreateProjectResource> {
	const response = await apiRequest<unknown>('/api/v1/app/projects', {
		method: 'POST',
		json: payload
	});
	return parseCreateProjectResponse(response);
}

export type DomainPreview = components['schemas']['DomainPreviewResource'];

const domainPreviewResponseSchema = z.object({
	data: z.object({ slug: z.string(), domain: z.string() })
});

export function parseDomainPreviewResponse(response: unknown): DomainPreview {
	return domainPreviewResponseSchema.parse(response).data;
}

/** The API's own generator, with collision suffixes. It reserves nothing. */
export async function getDomainPreview(name: string): Promise<DomainPreview> {
	const response = await apiRequest<unknown>('/api/v1/app/projects/domain-preview', {
		params: { name }
	});
	return parseDomainPreviewResponse(response);
}
