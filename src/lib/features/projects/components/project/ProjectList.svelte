<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { Project } from '$lib/api/resources/projects';
	import ProjectCard from '$lib/features/projects/components/project/ProjectCard.svelte';
	import ProjectCardSkeleton from '$lib/features/projects/components/project/ProjectCardSkeleton.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Pagination from '$lib/components/ui/Pagination.svelte';
	import { getProjectListErrorPresentation } from '../../presentation';
	import { resolve } from '$app/paths';

	type Props = {
		projects: Project[];
		currentPage: number;
		totalPages: number;
		isCheckingEmptyState?: boolean;
		isError?: Error | string | null;
		isLoading?: boolean;
		isFetching?: boolean;
		onPageChange?: (page: number) => void;
		onRetry?: () => void;
	};

	let {
		projects,
		currentPage,
		totalPages,
		isCheckingEmptyState = false,
		isError = null,
		isLoading = false,
		isFetching = false,
		onPageChange = () => {},
		onRetry
	}: Props = $props();

	const skeletonCount = 6;
	const skeletons = Array.from({ length: skeletonCount }, (_, i) => i);
	const errorPresentation = $derived(getProjectListErrorPresentation(isError));
</script>

<section
	class="grid grid-cols-1 gap-4 transition-opacity duration-150 sm:grid-cols-2 xl:grid-cols-3 {isFetching
		? 'opacity-60'
		: ''}"
	aria-label="Daftar proyek"
	aria-busy={isFetching}
>
	{#if isLoading}
		{#each skeletons as i (i)}
			<ProjectCardSkeleton />
		{/each}
	{:else if isError}
		<EmptyState
			icon={WarningCircle}
			tone="failed"
			title={errorPresentation.title}
			description={errorPresentation.description}
			class="col-span-full"
		>
			{#snippet action()}
				{#if errorPresentation.action === 'login'}
					<Button href={resolve('/login')}>Masuk kembali</Button>
				{:else}
					<Button onclick={onRetry}>
						<ArrowCounterClockwise size={18} aria-hidden="true" />
						Coba lagi
					</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if isCheckingEmptyState}
		{#each skeletons.slice(0, 3) as i (i)}
			<ProjectCardSkeleton />
		{/each}
	{:else if projects.length === 0}
		<EmptyState
			icon={MagnifyingGlass}
			title="Tidak menemukan proyek"
			description="Tidak ada proyek yang cocok. Coba kata kunci lain, atau ubah filter waktunya."
			class="col-span-full"
		/>
	{:else}
		{#each projects as project (project.id)}
			<ProjectCard {...project} />
		{/each}
	{/if}
</section>

{#if !isLoading && !isError && projects.length > 0 && totalPages > 1}
	<Pagination {currentPage} {totalPages} {onPageChange} disabled={isFetching} />
{/if}
