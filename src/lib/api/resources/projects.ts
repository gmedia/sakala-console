import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type Project = components['schemas']['GetCollectionProjectResource'];
type projectResponse =
	operations['projects.index']['responses'][200]['content']['application/json'];
export type ProjectsQueryParams = NonNullable<operations['projects.index']['parameters']['query']>;

const projectSchema = z.object({
	id: z.string(),
	name: z.string(),
	repository_full_name: z.string(),
	repository_source: z.enum(['public_url', 'github_installation']),
	github_installation_id: z.string().nullable(),
	github_repository_id: z.number().nullable(),
	branch: z.string(),
	thumbnail_url: z.string().nullable(),
	runtime_status: z.string(),
	last_deployed_at: z.string().nullable(),
	created_at: z.string()
}) satisfies z.ZodType<Project>;

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

const listProjectsResponseSchema = z.object({
	data: z.array(projectSchema),
	links: paginationLinksSchema,
	meta: paginationMetaSchema
}) satisfies z.ZodType<projectResponse>;

export async function getListProjects(params: ProjectsQueryParams): Promise<projectResponse> {
	const response = await apiRequest<unknown>('/api/v1/app/projects', { params });
	return parseListProjectsResponse(response);
}

export function parseListProjectsResponse(response: unknown): projectResponse {
	return listProjectsResponseSchema.parse(response);
}
