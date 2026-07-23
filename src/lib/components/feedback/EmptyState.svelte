<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';

	type Props = {
		icon?: Component<{ size?: number; 'aria-hidden'?: 'true' }>;
		iconSrc?: string;
		title: string;
		description: string;
		class?: string;
		action?: Snippet;
	};

	let { icon: Icon, iconSrc, title, description, class: cardClass, action }: Props = $props();
</script>

<Card class={`py-12 text-center sm:py-16 ${cardClass || ''}`}>
	<div
		class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"
	>
		{#if iconSrc}
			<img src={iconSrc} alt="icon" class="h-6 w-6" />
		{:else}
			<Icon size={24} aria-hidden="true" />
		{/if}
	</div>
	<h2 class="mt-5 text-xl font-montserrat-semibold tracking-tight">{title}</h2>
	<p class="mx-auto mt-2 max-w-md font-montserrat-light leading-7 text-muted">{description}</p>
	{#if action}
		<div class="mt-6">{@render action()}</div>
	{/if}
</Card>
