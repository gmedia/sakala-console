import type { Project, Repository } from './type';

export type DateFilterValue = '7d' | '30d' | '90d' | 'all';

export function filterProjects(
	projects: Project[],
	options: { search: string; date: DateFilterValue }
): Project[] {
	if (!projects?.length) return [];
	const now = Date.now();
	const searchLower = options.search.toLowerCase();

	return projects.filter((project) => {
		if (options.date !== 'all') {
			const days = options.date === '7d' ? 7 : options.date === '30d' ? 30 : 90;
			const createdAt = new Date(project.created_at).getTime();
			const diff = now - createdAt;
			if (diff > days * 24 * 60 * 60 * 1000) {
				return false;
			}
		}

		if (searchLower) {
			return project.project_name.toLowerCase().includes(searchLower);
		}
		return true;
	});
}

export function searchRepositories(repositories: Repository[], search: string): Repository[] {
	const searchLower = search.toLowerCase();
	return repositories.filter((repo) => repo.full_name.toLowerCase().includes(searchLower));
}
