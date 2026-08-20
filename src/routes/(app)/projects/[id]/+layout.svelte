<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { mockProjects } from '$lib/features/projects/mock';
	import ProjectHeaderBanner from '$lib/features/projects/components/detail/ProjectHeaderBanner.svelte';
	import { resolveRoute } from '$app/paths';

	let { children }: { children: Snippet } = $props();

	let currentPath = $derived($page.url.pathname);

	let project = $derived(mockProjects.find((p) => p.id === $page.params.id) || mockProjects[0]);
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
	<ProjectHeaderBanner {project} />

	<div class="border-b border-border mb-2">
		<nav class="-mb-px flex space-x-8" aria-label="Tabs">
			<a
				href={resolveRoute('/(app)/projects/[id]/deployments', { id: $page.params.id || '' })}
				class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
				{currentPath.includes('/deployments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Riwayat Deployment
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/environments', { id: $page.params.id || '' })}
				class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
				{currentPath.includes('/environments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Environment Variables
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/settings', { id: $page.params.id || '' })}
				class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
				{currentPath.includes('/settings')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Settings
			</a>
		</nav>
	</div>

	<div class="mt-2 w-full">
		{@render children()}
	</div>
</div>
