const FAILURE_TARGET_IDS = ['failure-summary', 'deployment-logs'];

/**
 * Brings the most useful failure context into view and moves focus there: the failure summary when
 * the API sent one, otherwise the log panel, so "Lihat detail error" always does something.
 */
export function revealElement(target: HTMLElement): void {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
	target.focus({ preventScroll: true });
}

export function revealFailureDetails(root: Document = document): HTMLElement | null {
	for (const id of FAILURE_TARGET_IDS) {
		const target = root.getElementById(id);
		if (target) {
			revealElement(target);
			return target;
		}
	}
	return null;
}
