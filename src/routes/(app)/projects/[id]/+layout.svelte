<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectHeaderBanner from '$lib/features/projects/components/detail/ProjectHeaderBanner.svelte';
	import { resolveRoute } from '$app/paths';

	let { children }: { children: Snippet } = $props();

	let currentPath = $derived($page.url.pathname);
	let projectId = $derived($page.params.id as string);

	const projectQuery = createProjectQuery(() => projectId);
</script>

<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
	{#if projectQuery.isLoading}
		<div class="flex flex-col gap-4 mb-4 animate-pulse">
			<div class="h-10 bg-surface-elevated/80 rounded-lg w-1/3"></div>
			<div class="h-12 bg-surface-elevated/50 rounded-lg w-full"></div>
		</div>
	{:else if projectQuery.isError}
		<div
			class="p-4 rounded-lg border border-error/50 bg-error-50 text-error font-montserrat text-sm mb-4"
		>
			Gagal memuat detail proyek. Proyek mungkin tidak ditemukan atau terjadi kesalahan server.
		</div>
	{:else if projectQuery.data}
		<ProjectHeaderBanner project={projectQuery.data} />
	{/if}

	<div class="border-b border-border mb-2">
		<nav class="-mb-px flex space-x-8" aria-label="Tabs">
			<a
				href={resolveRoute('/(app)/projects/[id]/deployments', { id: projectId || '' })}
				class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
				{currentPath.includes('/deployments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Riwayat Deployment
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/environments', { id: projectId || '' })}
				class="whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors
				{currentPath.includes('/environments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Environment Variables
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/settings', { id: projectId || '' })}
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
