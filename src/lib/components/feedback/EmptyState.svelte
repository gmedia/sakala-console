<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';
	import Card from '$lib/components/ui/Card.svelte';

	type Props = {
		icon?: Component<{ size?: number; 'aria-hidden'?: 'true' }>;
		tone?: 'neutral' | 'failed' | 'warning' | 'muted';
		title: string;
		description: string;
		class?: string;
		action?: Snippet;
	};

	const tones = {
		neutral: 'bg-primary-50 text-primary',
		failed: 'bg-error/10 text-error',
		warning: 'bg-accent-soft text-warning',
		muted: 'bg-background-soft text-muted'
	};

	let {
		icon: Icon,
		title,
		description,
		tone = 'neutral',
		class: cardClass,
		action
	}: Props = $props();
</script>

<Card class={cn('py-12 text-center sm:py-16', cardClass)}>
	{#if Icon}
		<div class={cn('mx-auto flex size-12 items-center justify-center rounded-card', tones[tone])}>
			<Icon size={24} aria-hidden="true" />
		</div>
	{/if}
	<h2 class="mt-4 text-xl">{title}</h2>
	<p class="mx-auto mt-2 max-w-xl text-sm text-muted">{description}</p>
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</Card>
