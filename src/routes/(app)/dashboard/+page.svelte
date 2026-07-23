<script lang="ts">
	import ApiStatusCard from '$lib/features/system/components/ApiStatusCard.svelte';
	import ProjectCard from '$lib/features/system/components/ProjectCard.svelte';
	import CreateProjectHeroCard from '$lib/features/projects/components/CreateProjectHeroCard.svelte';

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
	<CreateProjectHeroCard />

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
		<h2 class="text-3xl font-semibold whitespace-nowrap">Recent Deploys</h2>
		<div class="relative w-full sm:flex-1">
			<input
				type="text"
				placeholder="Search Your Project..."
				class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e] focus:outline-none"
			/>
		</div>
	</div>

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
