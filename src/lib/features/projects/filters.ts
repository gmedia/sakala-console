import type { ProjectBase } from './type';

export type DateFilterValue = '7_days' | '30_days' | '90_days' | 'all';

export function filterProjects<T extends ProjectBase>(
	projects: T[],
	options: { search: string; date: DateFilterValue }
): T[] {
	if (!projects?.length) return [];
	const now = Date.now();
	const searchLower = options.search.toLowerCase();

	return projects.filter((project) => {
		if (options.date !== 'all') {
			const days = options.date === '7_days' ? 7 : options.date === '30_days' ? 30 : 90;
			const createdAt = new Date(project.created_at).getTime();
			const diff = now - createdAt;
			if (diff > days * 24 * 60 * 60 * 1000) {
				return false;
			}
		}

		if (searchLower) {
			const displayName = project.name ?? project.project_name;
			return displayName.toLowerCase().includes(searchLower);
		}
		return true;
	});
}
