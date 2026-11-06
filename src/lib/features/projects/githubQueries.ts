import { createQuery } from '@tanstack/svelte-query';
import { ApiError } from '$lib/api/errors';
import { queryKeys } from '$lib/api/query-keys';
import {
	getGithubInstallations,
	getInstallationRepositories,
	getInstallationRepositoryBranches,
	getPublicRepositoryBranches,
	type GetInstallationRepositoriesParams
} from '$lib/api/resources/github';

/**
 * A 409 or a 403 will not change on its own, and asking GitHub again while it limits Sakala only
 * uses up the wait, so only other failures are worth a second try.
 */
function retryUnlessRefused(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && (error.status < 500 || error.isGithubRateLimited)) return false;
	return failureCount < 1;
}

export function createGithubInstallationsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.github.installations(),
		queryFn: () => getGithubInstallations(),
		staleTime: 60 * 1000
	}));
}

export function createInstallationRepositoriesQuery(
	installationId: () => string | null,
	params?: () => GetInstallationRepositoriesParams
) {
	return createQuery(() => {
		const id = installationId();
		const p = params?.();
		return {
			queryKey: id ? queryKeys.github.repositories(id, p) : ['github', 'repositories', 'none'],
			queryFn: () =>
				id
					? getInstallationRepositories(id, p)
					: Promise.reject(new Error('Installation is not selected')),
			enabled: !!id,
			staleTime: 60 * 1000,
			retry: retryUnlessRefused,
			// Keeps the list on screen while the next page loads, but never across installations.
			placeholderData: (previous: unknown, previousQuery?: { queryKey: readonly unknown[] }) =>
				previousQuery?.queryKey[2] === id ? (previous as never) : undefined
		};
	});
}

export type BranchSource =
	| { kind: 'installation'; installationId: string; repositoryId: string }
	| { kind: 'public'; repositoryUrl: string };

function branchSourceKey(source: BranchSource): string {
	return source.kind === 'installation'
		? `${source.installationId}/${source.repositoryId}`
		: source.repositoryUrl;
}

export function createRepositoryBranchesQuery(source: () => BranchSource | null) {
	return createQuery(() => {
		const current = source();
		return {
			queryKey: queryKeys.github.branches(current ? branchSourceKey(current) : 'none'),
			queryFn: () => {
				if (!current) return Promise.reject(new Error('Repository is not selected'));
				return current.kind === 'installation'
					? getInstallationRepositoryBranches(current.installationId, current.repositoryId)
					: getPublicRepositoryBranches(current.repositoryUrl);
			},
			enabled: !!current,
			staleTime: 60 * 1000,
			retry: retryUnlessRefused
		};
	});
}
