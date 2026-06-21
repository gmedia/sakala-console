<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { cn } from '$lib/utils/cn';

	type Props = {
		children: Snippet;
		href?: ResolvedPathname;
		externalHref?: string;
		variant?: 'primary' | 'secondary' | 'ghost';
		type?: 'button' | 'submit' | 'reset';
		disabled?: boolean;
		class?: string;
	};

	let {
		children,
		href,
		externalHref,
		variant = 'primary',
		type = 'button',
		disabled = false,
		class: className = ''
	}: Props = $props();

	const variants = {
		primary: 'border-primary bg-primary text-white hover:border-primary-dark hover:bg-primary-dark',
		secondary:
			'border-border-strong bg-surface text-foreground hover:border-primary hover:text-primary',
		ghost:
			'border-transparent bg-transparent text-muted hover:bg-background-soft hover:text-foreground'
	};

	const classes = $derived(
		cn(
			'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
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
	<button {type} {disabled} class={classes}>
		{@render children()}
	</button>
{/if}
