<script lang="ts">
	import CreateProjectStepper from '$lib/features/projects/components/create/CreateProjectStepper.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import { mockRepositories } from '$lib/features/projects/mock';
	import RepositoryStep from '$lib/features/projects/components/create/RepositoryStep.svelte';
	import AutoDetectStep from '$lib/features/projects/components/create/AutoDetectStep.svelte';
	import DeployStep from '$lib/features/projects/components/create/DeployStep.svelte';
	import DeploymentPreStep from '$lib/features/projects/components/create/DeploymentPreStep.svelte';
	import { initCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import CancelCreatePorjectAction from '$lib/features/projects/components/create/CancelCreatePorjectAction.svelte';
	import { detectProjectConfig } from '$lib/features/projects/create/mockDetectConfig';

	const wizard = initCreateProjectContext();
	const perPage = 5;

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Projects', href: '/projects' },
		{ label: 'New Project', current: true }
	];

	let scanning = $state(true);
	let builderDetected = $state<boolean | null>(null);
	let scanFailed = $state(false);

	async function runScan() {
		scanning = true;
		scanFailed = false;
		builderDetected = null;

		try {
			const result = await detectProjectConfig(
				wizard.selectedRepository,
				wizard.selectedBranch,
				'no-dockerfile'
			);
			builderDetected = result.hasDockerfile;
			if (result.detectedPort) {
				wizard.selectedPort = result.detectedPort;
			} else {
				wizard.selectedPort = '';
			}
		} catch {
			scanFailed = true;
		} finally {
			scanning = false;
		}
	}

	$effect(() => {
		if (wizard.currentStep !== 2) return;
		runScan();
	});
</script>

<svelte:head><title>Project Baru | Sakala Console</title></svelte:head>

<div class="flex flex-col items-center justify-center">
	<div class="flex w-full justify-between items-center">
		<Breadcrumb items={itemsBreadcrumb} class="mb-4 font-montserrat-semibold" />
		<CancelCreatePorjectAction />
	</div>
	<div class="max-w-3xl w-full">
		<CreateProjectStepper currentStep={wizard.currentStep} />
		<div class="flex flex-col gap-2 mt-4 mx-2">
			{#if wizard.currentStep === 1}
				{#if wizard.repositorySubstep === 'select-repository'}
					<RepositoryStep
						bind:repositorySource={wizard.repositorySource}
						bind:selectedRepositoryId={wizard.selectedRepositoryId}
						bind:currentPage={wizard.currentPage}
						bind:gitUrl={wizard.gitUrl}
						repositories={mockRepositories}
						onConnectGithub={wizard.connectGithub}
						githubConnected={wizard.githubConnected}
						{perPage}
						onNext={wizard.goToPrepareDeployment}
					/>
				{:else}
					<DeploymentPreStep
						repository={wizard.selectedRepository}
						bind:branch={wizard.selectedBranch}
						bind:port={wizard.selectedPort}
						bind:projectName={wizard.projectName}
						onNext={wizard.goToAutoDetect}
						onRepositoryChange={wizard.backToSelectRepository}
					/>
				{/if}
			{:else if wizard.currentStep === 2}
				<AutoDetectStep
					repository={wizard.selectedRepository}
					branch={wizard.selectedBranch}
					port={wizard.selectedPort}
					projectName={wizard.projectName}
					{scanning}
					{builderDetected}
					{scanFailed}
					onNext={wizard.goToDeploy}
					onRetryScan={runScan}
				/>
			{:else if wizard.currentStep === 3}
				<DeployStep projectName={wizard.projectName} />
			{/if}
		</div>
	</div>
</div>
