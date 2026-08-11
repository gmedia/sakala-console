<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { cn } from '$lib/utils/cn';

	type Props = HTMLButtonAttributes & {
		children: Snippet;
		href?: ResolvedPathname;
		externalHref?: string;
		variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
		type?: 'button' | 'submit' | 'reset';
		class?: string;
	};

	let {
		children,
		href,
		externalHref,
		variant = 'primary',
		class: className = '',
		...restProps
	}: Props = $props();

	const variants = {
		primary:
			'border-primary bg-primary text-white hover:border-primary-dark hover:bg-primary-dark cursor-pointer',
		secondary:
			'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
		ghost: 'border-transparent bg-transparent text-muted hover:text-foreground',
		outline: 'border border-black bg-transparent text-foreground cursor-pointer'
	};

	const classes = $derived(
		cn(
			'inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted disabled:border-none',
			variants[variant],
			className
		)
	);
</script>

{#if externalHref}
	<a href={externalHref} class={classes} target="_blank" rel="external noreferrer">
		{@render children()}
	</a>
{:else if href}
	<a {href} class={classes}>
		{@render children()}
	</a>
{:else}
	<button {...restProps} class={classes}>
		{@render children()}
	</button>
{/if}
