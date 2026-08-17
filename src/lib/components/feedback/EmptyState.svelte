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
		neutral: 'bg-primary/15 text-primary',
		failed: 'bg-error/20 text-error',
		warning: 'bg-warning/10 text-warning',
		muted: 'bg-muted/10 text-muted'
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

<Card class={`py-12 text-center sm:py-16 ${cardClass || ''}`}>
	<div class={cn('mx-auto flex size-12 items-center justify-center rounded-xl', tones[tone])}>
		<Icon size={24} aria-hidden="true" />
	</div>
	<h2 class="mt-5 text-xl font-montserrat-semibold tracking-tight">{title}</h2>
	<p class="mx-auto mt-2 max-w-xl font-montserrat leading-tight">{description}</p>
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</Card>
