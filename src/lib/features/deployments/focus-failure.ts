/** Brings a target into view and moves focus there, without animating for those who opted out. */
export function revealElement(target: HTMLElement): void {
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
	target.focus({ preventScroll: true });
}
