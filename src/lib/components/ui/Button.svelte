<script lang="ts">
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import type { ResolvedPathname } from '$app/types';
	import { cn } from '$lib/utils/cn';
	import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-classes';

	type Props = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			children: Snippet;
			href?: ResolvedPathname;
			externalHref?: string;
			/** `sameTab` is for links that come back here, such as the GitHub install redirect. */
			sameTab?: boolean;
			variant?: ButtonVariant;
			size?: ButtonSize;
			type?: 'button' | 'submit' | 'reset';
			disabled?: boolean;
			class?: string;
			ref?: HTMLElement | null | undefined;
		};

	let {
		children,
		href,
		externalHref,
		sameTab = false,
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		class: className = '',
		onclick,
		ref = $bindable(),
		...restProps
	}: Props = $props();

	const classes = $derived(buttonClasses(variant, size, className));
	const linkClasses = $derived(cn(classes, disabled && 'pointer-events-none opacity-50'));

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
		{...restProps}
		bind:this={ref}
		href={disabled ? undefined : externalHref}
		class={linkClasses}
		target={sameTab ? undefined : '_blank'}
		rel="external noreferrer"
		aria-disabled={disabled}
		onclick={handleAnchorClick}
	>
		{@render children()}
	</a>
{:else if href}
	<a
		{...restProps}
		bind:this={ref}
		href={disabled ? undefined : href}
		class={linkClasses}
		aria-disabled={disabled}
		onclick={handleAnchorClick}
	>
		{@render children()}
	</a>
{:else}
	<button {...restProps} bind:this={ref} {type} {disabled} class={classes} {onclick}>
		{@render children()}
	</button>
{/if}
