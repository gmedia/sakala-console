import type { Project } from './type';

export type DateFilterValue = '7d' | '30d' | 'all';

export function filterProjects(
	projects: Project[],
	options: { search: string; date: DateFilterValue }
): Project[] {
	if (!projects?.length) return [];
	const now = Date.now();
	const searchLower = options.search.toLowerCase();

	return projects.filter((project) => {
		if (options.date === 'all') return true;
		const days = options.date === '7d' ? 7 : 30;
		const createdAt = new Date(project.created_at).getTime();
		const diff = now - createdAt;
		if (diff > days * 24 * 60 * 60 * 1000) {
			return false;
		}

		if (searchLower) {
			return project.project_name.toLowerCase().includes(searchLower);
		}
		return true;
	});
}
