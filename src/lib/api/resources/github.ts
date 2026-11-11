import { z } from 'zod';
import { apiRequest } from '../client';
import type { components, operations } from '../generated/schema';

export type GithubInstallation = components['schemas']['GithubInstallationResource'];
export type GithubRepository = components['schemas']['GithubResource'];

export const githubInstallationSchema: z.ZodType<GithubInstallation> = z.object({
	id: z.string(),
	account_login: z.string(),
	account_type: z.string(),
	repository_selection: z.string(),
	status: z.string(),
	created_at: z.string(),
	updated_at: z.string()
});

export const githubInstallationsResponseSchema = z.object({
	data: z.array(githubInstallationSchema)
});

export const githubRepositorySchema: z.ZodType<GithubRepository> = z.object({
	id: z.union([z.string(), z.number()]).transform((val) => String(val)),
	name: z.string(),
	full_name: z.string(),
	clone_url: z.string(),
	default_branch: z.string(),
	pushed_at: z.string(),
	private: z.boolean()
});

/** Only what the wizard reads from Laravel's pagination `meta`. */
const repositoryPageMetaSchema = z.object({
	current_page: z.number(),
	last_page: z.number(),
	per_page: z.number(),
	total: z.number()
});

export const githubRepositoriesResponseSchema = z.object({
	data: z.array(githubRepositorySchema),
	meta: repositoryPageMetaSchema
});

export type GithubRepositoryPage = z.infer<typeof githubRepositoriesResponseSchema>;

export async function getGithubInstallations(): Promise<GithubInstallation[]> {
	const response = await apiRequest<unknown>('/api/v1/app/github/installations');
	return parseGithubInstallationsResponse(response);
}

export function parseGithubInstallationsResponse(response: unknown): GithubInstallation[] {
	return githubInstallationsResponseSchema.parse(response).data;
}

export type GetInstallationRepositoriesParams = NonNullable<
	operations['v1.app.github.installations.repositories.index']['parameters']['query']
>;

export async function getInstallationRepositories(
	installationId: string,
	params?: GetInstallationRepositoriesParams
): Promise<GithubRepositoryPage> {
	const response = await apiRequest<unknown>(
		`/api/v1/app/github/installations/${installationId}/repositories`,
		{ params }
	);
	return parseGithubRepositoriesResponse(response);
}

export function parseGithubRepositoriesResponse(response: unknown): GithubRepositoryPage {
	return githubRepositoriesResponseSchema.parse(response);
}

const githubBranchesResponseSchema = z.object({
	data: z.array(z.object({ name: z.string() }))
});

export function parseGithubBranchesResponse(response: unknown): string[] {
	return githubBranchesResponseSchema.parse(response).data.map((branch) => branch.name);
}

export async function getInstallationRepositoryBranches(
	installationId: string,
	repositoryId: string
): Promise<string[]> {
	const response = await apiRequest<unknown>(
		`/api/v1/app/github/installations/${installationId}/repositories/${repositoryId}/branches`
	);
	return parseGithubBranchesResponse(response);
}

export async function getPublicRepositoryBranches(repositoryUrl: string): Promise<string[]> {
	const response = await apiRequest<unknown>('/api/v1/app/github/repositories/branches', {
		params: { repository_url: repositoryUrl }
	});
	return parseGithubBranchesResponse(response);
}

export type ValidateRepositoryUrlRequest = components['schemas']['ValidateUrlRequest'];

export const singleGithubRepositoryResponseSchema = z.object({
	data: githubRepositorySchema
});

export function parseGithubRepositoryResponse(response: unknown): GithubRepository {
	return singleGithubRepositoryResponseSchema.parse(response).data;
}

export async function validateGithubRepository(repositoryUrl: string): Promise<GithubRepository> {
	const response = await apiRequest<unknown>('/api/v1/app/github/repositories/validate', {
		method: 'POST',
		json: { repository_url: repositoryUrl }
	});
	return parseGithubRepositoryResponse(response);
}
