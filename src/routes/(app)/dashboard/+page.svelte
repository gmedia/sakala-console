<script lang="ts">
	import { Boxes } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	import SearchInput from '$lib/components/ui/SearchInput.svelte';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import type { DateFilterValue } from '$lib/features/projects/filters';

	import { mockProjects } from '$lib/features/projects/mock';
	import ProjectList from '$lib/features/projects/components/ProjectList.svelte';
	import ProjectFilter from '$lib/features/projects/components/ProjectFilter.svelte';

	let search = $state('');
	let dateFilter: DateFilterValue = $state('30d');
</script>

<svelte:head><title>Overview | Sakala Console</title></svelte:head>
<header class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
	<div>
		<Badge tone="success">Online</Badge>
		<h1 class="mt-3 text-3xl font-semibold tracking-[-0.035em]">Selamat datang di Sakala.</h1>
		<p class="mt-2 max-w-2xl leading-7 text-muted">
			Pantau project, deployment, dan URL publik tanpa kehilangan konteks prosesnya.
		</p>
	</div>
</header>
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
		<div class="flex items-center justify-between sm:justify-normal gap-4 w-full sm:flex-1">
			<h2 class="text-2xl font-semibold font-montserrat-semibold whitespace-nowrap">
				Recent Deploys
			</h2>
			<ProjectFilter bind:value={dateFilter} />
		</div>
		<div class="relative w-full sm:max-w-max sm:flex-2">
			<SearchInput bind:value={search} placeholder="Cari..">
				{#snippet icon()}
					<img src="/icons/search.svg" alt="" class="h-4 w-4" />
				{/snippet}
			</SearchInput>
		</div>
	</div>

	<ProjectList projects={mockProjects} {dateFilter} {search} />
</main>
