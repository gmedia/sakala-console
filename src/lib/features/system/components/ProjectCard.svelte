<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Boxes } from '@lucide/svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	interface Props {
		name: string;
		domain: string;
		repo: string;
		createdAt: string;
		convention: string;
		isNew?: boolean;
	}

	let { name, domain, repo, createdAt, convention, isNew }: Props = $props();
</script>

<Card class="relative">
	<div class="flex items-start gap-3">
		<div class="mt-1">
			<Boxes size={24} class="text-primary" aria-hidden="true" />
		</div>
		<div class="flex-1">
			<p class="text-sm font-semibold">{name}</p>
			<a href={domain} class="text-xs text-muted">{domain}</a>
		</div>
	</div>
	<a
		href="https://github.com/{repo}"
		target="_blank"
		rel="noreferrer"
		class="mt-5 mb-5 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-semibold text-gray-800 hover:bg-primary-soft hover:text-primary-dark transition-colors"
	>
		<span
			class="size-3.5 flex items-center justify-center [&>svg]:size-full [&>svg]:fill-current text-gray-600"
		>
			<img src="src/lib/assets/github.svg" alt="" />
		</span>
		<span>{repo}</span>
	</a>
	<p class="mt-1 text-sm text-muted">{convention}</p>
	<p class="mt-1 mb-6 text-sm text-muted">{createdAt}</p>
	{#if isNew}
		<Badge tone="success" class="absolute bottom-4 right-4">New</Badge>
	{/if}
</Card>
