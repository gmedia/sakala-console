import type { Project } from './type';

export type DateFilterValue = '7d' | '30d' | 'all';

export function filterProjects(
	projects: Project[],
	options: { search: string; date: DateFilterValue }
): Project[] {
	return projects
		.filter((project) => {
			if (options.date === 'all') return true;
			const days = options.date === '7d' ? 7 : 30;
			const now = Date.now();
			const createdAt = new Date(project.created_at).getTime();
			const diff = now - createdAt;
			return diff <= days * 24 * 60 * 60 * 1000;
		})
		.filter((project) => {
			return project.project_name.toLowerCase().includes(options.search.toLowerCase());
		});
}
