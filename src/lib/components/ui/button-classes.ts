import { cn } from '$lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'terminal';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<ButtonVariant, string> = {
	primary: 'border-primary bg-primary text-white hover:border-primary-dark hover:bg-primary-dark',
	secondary:
		'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
	ghost:
		'border-transparent bg-transparent text-foreground/70 hover:bg-background-soft hover:text-foreground',
	danger: 'border-error bg-error text-white hover:border-error-dark hover:bg-error-dark',
	link: 'border-transparent bg-transparent text-primary-dark underline-offset-2 hover:underline',
	/** On the dark terminal, where the focus ring has to be light as well. */
	terminal:
		'border-white/25 bg-transparent text-terminal-text hover:bg-white/10 focus-visible:outline-white'
};

/** Touch layouts get 44 px whatever the size. The drawer is up to 1024 px, and so is this. */
const sizes: Record<ButtonSize, string> = {
	sm: 'min-h-control-sm px-3 text-sm max-lg:min-h-control-lg',
	md: 'min-h-control-md px-4 text-sm max-lg:min-h-control-lg',
	lg: 'min-h-control-lg px-4 text-sm',
	icon: 'size-control-md shrink-0 p-0 max-lg:size-control-lg',
	'icon-sm': 'size-control-sm shrink-0 p-0 max-lg:size-control-lg'
};

/** For primitives that render their own element, such as a dialog's close button. */
export function buttonClasses(
	variant: ButtonVariant = 'primary',
	size: ButtonSize = 'md',
	className?: string
): string {
	return cn(
		'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border font-semibold transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-background-soft disabled:text-muted',
		variant === 'link' ? 'min-h-6 text-sm' : sizes[size],
		variants[variant],
		className
	);
}
