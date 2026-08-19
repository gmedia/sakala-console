<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { cn } from '$lib/utils/cn';

	type Props = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			children: Snippet;
			href?: ResolvedPathname;
			externalHref?: string;
			variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
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
		class: className = '',
		onclick,
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

	function handleAnchorClick(e: MouseEvent) {
		if (disabled) {
			e.preventDefault();
			return;
		}
		onclick?.(e as MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement });
	}
</script>

{#if externalHref}
	<a
		href={disabled ? undefined : externalHref}
		class={cn(classes, disabled && 'pointer-events-none opacity-50 cursor-not-allowed')}
		target="_blank"
		rel="external noreferrer"
		aria-disabled={disabled}
		onclick={handleAnchorClick}
	>
		{@render children()}
	</a>
{:else if href}
	<a
		href={disabled ? undefined : href}
		class={cn(classes, disabled && 'pointer-events-none opacity-50 cursor-not-allowed')}
		aria-disabled={disabled}
		onclick={handleAnchorClick}
	>
		{@render children()}
	</a>
{:else}
	<button {...restProps} {type} {disabled} class={classes} {onclick}>
		{@render children()}
	</button>
{/if}
