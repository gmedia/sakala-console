/** One pattern for every tab: `page · project · Sakala`. The project part only exists inside one. */
export function pageTitle(page: string, project?: string | null): string {
	return [page, project, 'Sakala'].filter(Boolean).join(' · ');
}
