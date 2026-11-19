import { normalizeGithubRepositoryUrl } from '../validation/repositoryUrl';

export type ParsedGitUrl = {
	owner: string;
	name: string;
	fullName: string;
};

/** The repository a typed URL names, in any form the field accepts, or null. */
export function parseGitUrl(url: string): ParsedGitUrl | null {
	const result = normalizeGithubRepositoryUrl(url);
	return result.ok ? { owner: result.owner, name: result.name, fullName: result.fullName } : null;
}
