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

export const githubRepositoriesResponseSchema = z.object({
	data: z.array(githubRepositorySchema)
});

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
): Promise<GithubRepository[]> {
	const response = await apiRequest<unknown>(
		`/api/v1/app/github/installations/${installationId}/repositories`,
		{ params }
	);
	return parseGithubRepositoriesResponse(response);
}

export function parseGithubRepositoriesResponse(response: unknown): GithubRepository[] {
	return githubRepositoriesResponseSchema.parse(response).data;
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
