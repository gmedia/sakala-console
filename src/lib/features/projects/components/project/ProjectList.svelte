<script lang="ts">
	import { RotateCcw, CircleAlert, CircleOff } from '@lucide/svelte';
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
		isAccountEmpty?: boolean;
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
		isAccountEmpty = false,
		isCheckingEmptyState = false,
		isError = null,
		isLoading = false,
		isFetching = false,
		onPageChange = () => {},
		onRetry
	}: Props = $props();

	const guide_rule = 'https://sakala.dev/docs';

	const skeletonCount = 6;
	const skeletons = Array.from({ length: skeletonCount }, (_, i) => i);
	const errorPresentation = $derived(getProjectListErrorPresentation(isError));
</script>

<section
	class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity duration-150 {isFetching
		? 'opacity-60'
		: ''}"
	aria-label="List Projects"
	aria-busy={isFetching}
>
	{#if isLoading}
		{#each skeletons as i (i)}
			<ProjectCardSkeleton />
		{/each}
	{:else if isError}
		<EmptyState
			icon={CircleAlert}
			tone="failed"
			title={errorPresentation.title}
			description={errorPresentation.description}
			class="col-span-full border-none bg-transparent shadow-none"
		>
			{#snippet action()}
				{#if errorPresentation.action === 'login'}
					<a
						href={resolve('/login')}
						class="inline-flex cursor-pointer gap-2 rounded-lg border border-muted/20 bg-primary px-4 py-3 font-montserrat-semibold text-white"
					>
						Login kembali
					</a>
				{:else}
					<button
						type="button"
						class="inline-flex cursor-pointer gap-2 rounded-lg border border-muted/20 bg-primary px-4 py-3 font-montserrat-semibold text-white"
						onclick={onRetry}
					>
						<RotateCcw class="h-6 w-6" />
						Coba lagi
					</button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if isCheckingEmptyState}
		{#each skeletons.slice(0, 3) as i (i)}
			<ProjectCardSkeleton />
		{/each}
	{:else if isAccountEmpty}
		<EmptyState
			icon={CircleOff}
			title="Belum ada proyek"
			description="Kamu belum punya project apapun. Buat project pertamamu untuk melihatnya muncul di sini."
			class="col-span-full border-none bg-transparent shadow-none"
		>
			{#snippet action()}
				<p class="text-sm text-muted">
					Belum pernah deploy?
					<a href={guide_rule} class="underline underline-offset-2">
						Baca panduan deploy pertamamu.
					</a>
				</p>
			{/snippet}
		</EmptyState>
	{:else if projects.length === 0}
		<EmptyState
			icon={CircleOff}
			title="Tidak menemukan project"
			description="Project yang kamu cari tidak ditemukan. Coba periksa kembali kata kunci pencarianmu atau filter tanggal yang digunakan."
			class="col-span-full border-none bg-transparent shadow-none"
		/>
	{:else}
		{#each projects as project (project.id)}
			<ProjectCard {...project} loading={isFetching} />
		{/each}
	{/if}
</section>

{#if !isLoading && !isError && projects.length > 0 && totalPages > 1}
	<Pagination {currentPage} {totalPages} {onPageChange} disabled={isFetching} />
{/if}
