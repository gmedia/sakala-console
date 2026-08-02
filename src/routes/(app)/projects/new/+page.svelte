<script lang="ts">
	import CreateProjectStepper from '$lib/features/projects/components/CreateProjectStepper.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import { mockRepositories } from '$lib/features/projects/mock';
	import RepositoryStep from '$lib/features/projects/components/RepositoryStep.svelte';

	let repositorySource = $state<'github' | 'git-url'>('github');
	let selectedRepositoryId = $state<string | null>(null);
	let gitUrl = $state('');
	let currentPage = $state(1);
	let currentStep = $state(1);
	const perPage = 5;

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Projects', href: '/projects' },
		{ label: 'New Project', current: true }
	];
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
		<CreateProjectStepper
			{currentStep}
			allowClickUpComing={true}
			onStepClick={(step) => (currentStep = step)}
		/>
		<div class="flex flex-col gap-2 mt-4 mx-2">
			{#if currentStep === 1}
				<RepositoryStep
					bind:repositorySource
					bind:selectedRepositoryId
					bind:currentPage
					bind:gitUrl
					repositories={mockRepositories}
					{perPage}
					onNext={() => (currentStep = 2)}
				/>
			{:else if currentStep === 2}
				<h1>Auto Detect</h1>
				<p>Setup project secara otomatis dengan auto detect.</p>
			{:else if currentStep === 3}
				<h1>Deploy</h1>
				<p>Deploy project ke Sakala.</p>
			{/if}
		</div>
	</div>
</div>
