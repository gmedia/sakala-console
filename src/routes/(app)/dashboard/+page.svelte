<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/types/project';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';

	const projects: Project[] = [
		{
			id: 1,
			project_name: 'Project 1',
			repository_name: 'repo1',
			status: 'success',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: null,
			created_at: '08 Mar'
		},
		{
			id: 2,
			project_name: 'Sakala',
			repository_name: 'sakala-console',
			status: 'failed',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: '404',
			created_at: '17 Jul'
		},
		{
			id: 3,
			project_name: 'Project 2',
			repository_name: 'repo2',
			status: 'pending',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Menunggu build selesai...',
			created_at: '20 Feb'
		},
		{
			id: 4,
			project_name: 'Project 1',
			repository_name: 'repo1',
			status: 'success',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: null,
			created_at: '08 Mar'
		},
		{
			id: 5,
			project_name: 'Sakala',
			repository_name: 'sakala-console',
			status: 'failed',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: '404',
			created_at: '17 Jul'
		},
		{
			id: 6,
			project_name: 'Project 2',
			repository_name: 'repo2',
			status: 'pending',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Menunggu build selesai...',
			created_at: '20 Feb'
		}
	];
</script>

<svelte:head><title>Overview | Sakala Console</title></svelte:head>
<header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"></header>
<main class="flex flex-col gap-8">
	<EmptyState
		icon={Boxes}
		title="Create Project + CTA"
		description="Sakala akan membaca project dari repository Github anda untuk di publish dan siap untuk dibagikan "
	>
		{#snippet action()}
			<Button href={resolve('/projects/new')} variant="secondary">Upload project</Button>
		{/snippet}
	</EmptyState>

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
		<div class="flex items-center gap-4 w-full sm:flex-1">
			<h2 class="text-2xl font-semibold whitespace-nowrap">Recent Deploys</h2>
			<select
				class="rounded-lg border w-max border-gray-300 bg-white py-2 text-sm focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] focus:outline-none"
			>
				<option>30 days</option>
				<option>7 days</option>
				<option>1 day</option>
			</select>
		</div>
		<div class="relative max-w-max sm:flex-2">
			<input
				type="text"
				placeholder="Search Your Project..."
				class="max-w-max rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] focus:outline-none"
			/>
		</div>
	</div>

	<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
		{#each projects as project (project.id)}
			<ProjectCard {...project} />
		{/each}
	</section>

	<!-- <ApiStatusCard /> -->
</main>
