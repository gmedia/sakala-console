<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ApiStatusCard from '$lib/features/system/components/ApiStatusCard.svelte';

	import ProjectCard from '$lib/features/system/components/ProjectCard.svelte';

	const projects = [
		{
			id: 1,
			name: 'Project 1',
			domain: 'domain1.com',
			repo: 'repo1',
			createdAt: '08 Mar on Main',
			convention: 'feat : UI login',
			isNew: true
		},
		{
			id: 2,
			name: 'Sakala',
			domain: 'sakala.dev',
			repo: 'sakala-console',
			createdAt: '17 Jul on Main',
			convention: 'feat(dashboard): dashboard UI',
			isNew: true
		},
		{
			id: 3,
			name: 'Project 2',
			domain: 'domain2.com',
			repo: 'repo2',
			createdAt: '20 Feb on Main',
			convention: 'Fix(login page): Auth Redirect',
			isNew: true
		}
	];
</script>

<svelte:head><title>Overview | Sakala Console</title></svelte:head>

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

	<header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
		<h1 class="text-3xl font-semibold whitespace-nowrap">Recent Deploys</h1>
		<div class="relative w-full sm:flex-1">
			<input
				type="text"
				placeholder="Search Your Project..."
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] focus:outline-none"
			/>
		</div>
	</header>

	<section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ringkasan Sakala">
		{#each projects as project (project.id)}
			<ProjectCard
				name={project.name}
				domain={project.domain}
				repo={project.repo}
				createdAt={project.createdAt}
				convention={project.convention}
				isNew={project.isNew}
			/>
		{/each}
	</section>

	<ApiStatusCard />
</main>
