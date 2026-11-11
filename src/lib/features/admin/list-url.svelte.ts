import { goto } from '$app/navigation';
import { page } from '$app/state';
import { nextSearch, type ParamPatch } from './url-state';

/**
 * Reads and writes the current page's query string. A filter change is its own history entry, so
 * Back undoes it; typing in the search box replaces the entry instead of adding one per keystroke.
 */
export function useListUrl() {
	return {
		get search(): URLSearchParams {
			return page.url.searchParams;
		},
		update(patch: ParamPatch, { replace = false }: { replace?: boolean } = {}) {
			const query = nextSearch(page.url.searchParams, patch);
			if (query === page.url.search) return;
			// The path is the page we are on, already resolved; only the query changes.
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			void goto(`${page.url.pathname}${query}`, {
				keepFocus: true,
				noScroll: true,
				replaceState: replace
			});
		}
	};
}
