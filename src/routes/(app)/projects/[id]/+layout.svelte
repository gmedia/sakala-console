<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/stores';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectHeaderBanner from '$lib/features/projects/components/detail/ProjectHeaderBanner.svelte';
	import { resolveRoute } from '$app/paths';
	import { initProjectDetailContext } from '$lib/features/projects/detail/projectDetailState.svelte';
	import {
		activeProjectTab,
		PROJECT_TAB_LABELS,
		PROJECT_TABS,
		type ProjectTab
	} from '$lib/features/projects/overview/tabs';

	let { children }: { children: Snippet } = $props();

	let projectId = $derived($page.params.id as string);
	let activeTab = $derived(activeProjectTab($page.url.pathname, projectId));

	// Five tabs do not fit 320 px, so the strip scrolls: the current tab is kept in view, and a fade
	// at the edge says there is more.
	let tabNav: HTMLElement | null = $state(null);
	let moreTabs = $state(false);

	function measureTabs() {
		if (!tabNav) return;
		moreTabs = tabNav.scrollLeft + tabNav.clientWidth < tabNav.scrollWidth - 1;
	}

	/** A tab reached by keyboard comes fully into view, past the fade. */
	function revealTab(event: FocusEvent) {
		(event.target as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	// scrollLeft rather than scrollIntoView: Chrome moves the Tab starting point to an element
	// scrolled into view, which would skip the skip link and the header.
	$effect(() => {
		void activeTab;
		const current = tabNav?.querySelector<HTMLElement>('[aria-current="page"]');
		if (tabNav && current) {
			const end = current.offsetLeft + current.offsetWidth;
			if (end > tabNav.scrollLeft + tabNav.clientWidth)
				tabNav.scrollLeft = end - tabNav.clientWidth;
			else if (current.offsetLeft < tabNav.scrollLeft) tabNav.scrollLeft = current.offsetLeft;
		}
		measureTabs();
	});

	function tabHref(tab: ProjectTab) {
		const id = projectId || '';
		switch (tab) {
			case 'overview':
				return resolveRoute('/(app)/projects/[id]', { id });
			case 'deployments':
				return resolveRoute('/(app)/projects/[id]/deployments', { id });
			case 'monitoring':
				return resolveRoute('/(app)/projects/[id]/monitoring', { id });
			case 'environments':
				return resolveRoute('/(app)/projects/[id]/environments', { id });
			case 'settings':
				return resolveRoute('/(app)/projects/[id]/settings', { id });
		}
	}

	const detailState = initProjectDetailContext();

	// This layout stays mounted across projects, and a draft belongs to one project.
	let draftProjectId: string | undefined;
	$effect.pre(() => {
		if (draftProjectId !== undefined && projectId !== draftProjectId) detailState.resetDraft();
		draftProjectId = projectId;
	});

	const projectQuery = createProjectQuery(() => projectId, { poll: true });
</script>

<svelte:window onresize={measureTabs} />

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

	<div class="relative w-full min-w-0 border-b border-border">
		<nav
			bind:this={tabNav}
			onscroll={measureTabs}
			onfocusin={revealTab}
			class="-mb-px flex gap-x-2 overflow-x-auto sm:gap-x-8"
			aria-label="Bagian proyek"
		>
			{#each PROJECT_TABS as tab (tab)}
				<a
					href={tabHref(tab)}
					aria-current={activeTab === tab ? 'page' : undefined}
					class="border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors
					{activeTab === tab
						? 'border-primary text-primary'
						: 'border-transparent text-muted hover:border-border hover:text-foreground'}"
				>
					{PROJECT_TAB_LABELS[tab]}
				</a>
			{/each}
		</nav>
		{#if moreTabs}
			<span
				class="pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-background"
				aria-hidden="true"
			></span>
		{/if}
	</div>

	<div class="w-full">
		{@render children()}
	</div>
</div>
