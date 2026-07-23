<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/types/project';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';

	import ProjectCard from '$lib/features/projects/components/ProjectCard.svelte';
	import ProjectFilter from '$lib/features/projects/components/ProjectFilter.svelte';
	import SearchInput from '$lib/components/ui/SearchInput.svelte';

	let search = $state('');

	const projects: Project[] = [
		{
			id: 1,
			project_name: 'E-Commerce Platform',
			repository_name: 'ecommerce-backend',
			status: 'success',
			thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
			status_message: null,
			created_at: '08 Mar'
		},
		{
			id: 2,
			project_name: 'Customer Portal',
			repository_name: 'customer-portal-frontend',
			status: 'failed',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Dependency conflict: react@18.2.0 not compatible',
			created_at: '17 Jul'
		},
		{
			id: 3,
			project_name: 'Analytics Dashboard',
			repository_name: 'analytics-service',
			status: 'pending',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Waiting for CI pipeline to start...',
			created_at: '20 Feb'
		},
		{
			id: 4,
			project_name: 'Mobile App',
			repository_name: 'mobile-app-ios',
			status: 'pending',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Waiting for build artifacts from the CI pipeline',
			created_at: '15 Apr'
		},
		{
			id: 5,
			project_name: 'Admin Panel',
			repository_name: 'admin-dashboard',
			status: 'failed',
			thumbnail_url: 'https://picsum.photos/600/400',
			status_message: 'Build timeout after 10 minutes',
			created_at: '03 Jun'
		},
		{
			id: 6,
			project_name: 'Notification Service',
			repository_name: 'notification-microservice',
			status: 'success',
			thumbnail_url: 'https://placehold.co/600x400/EEE/31343C?text=Thumbnail+preview+hasil+deploy',
			status_message: null,
			created_at: '30 May'
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
			<h2 class="text-2xl font-semibold font-montserrat whitespace-nowrap">Recent Deploys</h2>
			<ProjectFilter />
		</div>
		<div class="relative max-w-max sm:flex-2">
			<SearchInput bind:value={search} placeholder="Cari..">
				{#snippet icon()}
					<img src="/icons/search.svg" alt="" class="h-4 w-4" />
				{/snippet}
			</SearchInput>
		</div>
	</div>

	<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
		{#each projects as project (project.id)}
			<ProjectCard {...project} />
		{/each}
	</section>
</main>
