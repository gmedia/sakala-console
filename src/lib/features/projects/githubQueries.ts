import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import { getGithubInstallations, getInstallationRepositories } from '$lib/api/resources/github';

export function createGithubInstallationsQuery() {
	return createQuery(() => ({
		queryKey: queryKeys.github.installations(),
		queryFn: () => getGithubInstallations(),
		staleTime: 60 * 1000
	}));
}

export function createInstallationRepositoriesQuery(
	installationId: () => string | null,
	params?: () => { page?: number; per_page?: number }
) {
	return createQuery(() => {
		const id = installationId();
		const p = params?.();
		return {
			queryKey: id ? queryKeys.github.repositories(id) : ['github', 'repositories', 'none'],
			queryFn: () => (id ? getInstallationRepositories(id, p) : Promise.resolve([])),
			enabled: !!id,
			staleTime: 60 * 1000
		};
	});
}
