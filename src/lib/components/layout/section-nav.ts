import { cn } from '$lib/utils/cn';

/**
 * A link in a page's section navigation (project settings, account settings): short links that
 * wrap instead of scrolling, so every section stays visible at 320 px, 44 px tall on touch layouts.
 */
export function sectionNavLinkClass(active: boolean): string {
	return cn(
		'inline-flex min-h-8 items-center gap-1.5 rounded-control px-3 text-sm font-medium transition-colors max-sm:min-h-control-lg',
		active
			? 'bg-primary-50 text-primary-dark'
			: 'text-muted hover:bg-background-soft hover:text-foreground'
	);
}
