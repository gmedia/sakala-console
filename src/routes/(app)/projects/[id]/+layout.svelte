<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectHeaderBanner from '$lib/features/projects/components/detail/ProjectHeaderBanner.svelte';
	import { resolveRoute } from '$app/paths';
	import { initProjectDetailContext } from '$lib/features/projects/detail/projectDetailState.svelte';

	let { children }: { children: Snippet } = $props();

	let currentPath = $derived($page.url.pathname);
	let projectId = $derived($page.params.id as string);

	const detailState = initProjectDetailContext();

	// This layout stays mounted across projects, and a draft belongs to one project.
	let draftProjectId: string | undefined;
	$effect.pre(() => {
		if (draftProjectId !== undefined && projectId !== draftProjectId) detailState.resetDraft();
		draftProjectId = projectId;
	});

	const projectQuery = createProjectQuery(() => projectId, { poll: true });
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	{#if projectQuery.isLoading}
		<div class="mb-4 flex flex-col gap-4">
			<div class="skeleton h-10 w-1/3"></div>
			<div class="skeleton h-12 w-full"></div>
		</div>
	{:else if projectQuery.isError}
		<div class="mb-4 rounded-control border border-error/50 bg-error-50 p-4 text-sm text-error">
			Gagal memuat detail proyek. Proyek mungkin tidak ditemukan atau terjadi kesalahan server.
		</div>
	{:else if projectQuery.data}
		<ProjectHeaderBanner project={projectQuery.data} />
	{/if}

	<div class="w-full min-w-0 border-b border-border">
		<nav class="-mb-px flex gap-x-6 overflow-x-auto sm:gap-x-8" aria-label="Bagian proyek">
			<a
				href={resolveRoute('/(app)/projects/[id]/deployments', { id: projectId || '' })}
				aria-current={currentPath.includes('/deployments') ? 'page' : undefined}
				class="border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors
				{currentPath.includes('/deployments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Riwayat
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/environments', { id: projectId || '' })}
				aria-current={currentPath.includes('/environments') ? 'page' : undefined}
				class="border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors
				{currentPath.includes('/environments')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Variabel
			</a>
			<a
				href={resolveRoute('/(app)/projects/[id]/settings', { id: projectId || '' })}
				aria-current={currentPath.includes('/settings') ? 'page' : undefined}
				class="border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors
				{currentPath.includes('/settings')
					? 'border-primary text-primary'
					: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
			>
				Pengaturan
			</a>
		</nav>
	</div>

	<div class="w-full">
		{@render children()}
	</div>
</div>
