import type { Project } from './type';

export type DateFilterValue = '7d' | '30d' | 'all';

export function filterProjectsByDate(projects: Project[], filter: DateFilterValue): Project[] {
	if (filter === 'all') return projects;

	const days = filter === '7d' ? 7 : 30;
	const now = Date.now();

	return projects.filter((project) => {
		const createdAt = new Date(project.created_at).getTime();
		const diff = now - createdAt;

		return diff <= days * 24 * 60 * 60 * 1000;
	});
}
