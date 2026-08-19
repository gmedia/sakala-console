<script lang="ts">
	import CreateProjectStepper from '$lib/features/projects/components/create/CreateProjectStepper.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import { mockCreateProject, mockRepositories } from '$lib/features/projects/mock';
	import RepositoryStep from '$lib/features/projects/components/create/RepositoryStep.svelte';
	import AutoDetectStep from '$lib/features/projects/components/create/AutoDetectStep.svelte';
	import ConfigureProjectStep from '$lib/features/projects/components/create/ConfigureProjectStep.svelte';
	import { initCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import CancelCreatePorjectAction from '$lib/features/projects/components/create/CancelCreatePorjectAction.svelte';
	import type { CreateProjectPayload } from '$lib/features/projects/type';
	import { detectProjectConfig } from '$lib/features/projects/create/mockDetectConfig';

	const wizard = initCreateProjectContext();

	let isSubmitting = $state(false);
	let submitError = $state<string | null>(null);

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Projects' },
		{ label: 'New Project', current: true }
	];

	async function handleCreateProject(payload: CreateProjectPayload) {
		isSubmitting = true;
		submitError = null;

		try {
			const result = await mockCreateProject(payload);
			wizard.goToAutoDetect(result);
			await runScan();
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Gagal membuat proyek';
		} finally {
			isSubmitting = false;
		}
	}

	async function runScan() {
		wizard.startScan();

		try {
			const result = await detectProjectConfig(
				wizard.selectedRepository,
				wizard.selectedBranch,
				wizard.selectedPort,
				'dockerfile'
			);
			wizard.selectedPort = result.detectedPort ?? '';
			wizard.completeScan(result.hasDockerfile);
		} catch {
			wizard.failScan();
		}
	}
</script>

<svelte:head><title>Project Baru | Sakala Console</title></svelte:head>

<div class="flex flex-col items-center justify-center">
	<div class="flex w-full justify-between items-center">
		<Breadcrumb items={itemsBreadcrumb} class="mb-4 font-montserrat-semibold" />
		<CancelCreatePorjectAction />
	</div>
	<div class="max-w-2xl w-full">
		<CreateProjectStepper currentStep={wizard.currentStep} />
		<div class="flex flex-col gap-2 mt-4 mx-2">
			{#if wizard.currentStep === 1}
				{#if wizard.repositorySubstep === 'select-repository'}
					<RepositoryStep
						repositories={mockRepositories}
						githubConnected={wizard.githubConnected}
						onNext={wizard.goToPrepareDeployment}
						onConnectGithub={wizard.connectGithub}
					/>
				{:else}
					<ConfigureProjectStep
						onSubmit={handleCreateProject}
						onRepositoryChange={wizard.backToSelectRepository}
						{isSubmitting}
						error={submitError}
					/>
				{/if}
			{:else if wizard.currentStep === 2}
				<AutoDetectStep onNext={wizard.goToDeploy} onRetryScan={runScan} />
			{/if}
		</div>
	</div>
</div>
