<script lang="ts">
	import CreateProjectStepper from '$lib/features/projects/components/CreateProjectStepper.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import { mockRepositories } from '$lib/features/projects/mock';
	import RepositoryStep from '$lib/features/projects/components/RepositoryStep.svelte';
	import AutoDetectStep from '$lib/features/projects/components/AutoDetectStep.svelte';
	import DeployStep from '$lib/features/projects/components/DeployStep.svelte';
	import DeploymentPreStep from '$lib/features/projects/components/DeploymentPreStep.svelte';

	let repositorySource = $state<'github' | 'git-url'>('github');
	let selectedRepositoryId = $state<string | null>(null);
	let gitUrl = $state('');
	let selectedBranch = $state<string>('');
	let selectedPort = $state<string>('3000');
	let projectName = $state<string>('');
	let currentPage = $state(1);
	let currentStep = $state<1 | 2 | 3>(1);
	let repositorySubstep = $state<'select-repository' | 'prepare-deployment'>('select-repository');
	const perPage = 5;

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Projects', href: '/projects' },
		{ label: 'New Project', current: true }
	];

	const selectedRepository = $derived(
		mockRepositories.find((repo) => repo.id === selectedRepositoryId) ?? null
	);

	$effect(() => {
		if (selectedRepository) {
			selectedBranch = selectedRepository?.default_branch ?? '';
		}
	});
</script>

<svelte:head><title>Project Baru | Sakala Console</title></svelte:head>

<div class="flex flex-col items-center justify-center">
	<div class="flex w-full justify-between items-center">
		<Breadcrumb items={itemsBreadcrumb} class="mb-4 font-montserrat-semibold" />
		<Button variant="outline" href="/projects" class="mb-4 px-3 border-2 border-muted text-muted">
			Batal
		</Button>
	</div>
	<div class="max-w-2xl w-full">
		<CreateProjectStepper {currentStep} />
		<div class="flex flex-col gap-2 mt-4 mx-2">
			{#if currentStep === 1}
				{#if repositorySubstep === 'select-repository'}
					<RepositoryStep
						bind:repositorySource
						bind:selectedRepositoryId
						bind:currentPage
						bind:gitUrl
						repositories={mockRepositories}
						{perPage}
						onNext={() => (repositorySubstep = 'prepare-deployment')}
					/>
				{:else}
					<DeploymentPreStep
						repository={selectedRepository}
						bind:branch={selectedBranch}
						bind:port={selectedPort}
						bind:projectName
						onNext={() => (currentStep = 2)}
						onRepositoryChange={() => (repositorySubstep = 'select-repository')}
					/>
				{/if}
			{:else if currentStep === 2}
				<AutoDetectStep
					repository={selectedRepository}
					branch={selectedBranch}
					port={selectedPort}
					{projectName}
					onNext={() => (currentStep = 3)}
				/>
			{:else if currentStep === 3}
				<DeployStep repository={selectedRepository} />
			{/if}
		</div>
	</div>
</div>
