<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CreateProjectStepper from '$lib/features/projects/components/create/CreateProjectStepper.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import RepositoryStep from '$lib/features/projects/components/create/RepositoryStep.svelte';
	import ConfigureProjectStep from '$lib/features/projects/components/create/ConfigureProjectStep.svelte';
	import CancelCreatePorjectAction from '$lib/features/projects/components/create/CancelCreatePorjectAction.svelte';
	import { initCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import { createProjectMutation } from '$lib/features/projects/mutations';
	import {
		createGithubInstallationsQuery,
		createInstallationRepositoriesQuery
	} from '$lib/features/projects/githubQueries';
	import {
		mapCreateProjectErrors,
		type CreateProjectFieldErrors
	} from '$lib/features/projects/validation/createProjectSchema';
	import type { StoreProjectRequest } from '$lib/api/resources/projects';
	import type { Repository } from '$lib/features/projects/type';
	import { mockRepositories } from '$lib/features/projects/mock/mock';

	const wizard = initCreateProjectContext();
	const createMutation = createProjectMutation();

	const installationsQuery = createGithubInstallationsQuery();
	const firstInstallationId = $derived(
		installationsQuery.data && installationsQuery.data.length > 0
			? installationsQuery.data[0].id
			: null
	);

	const reposQuery = createInstallationRepositoriesQuery(() => firstInstallationId);

	const githubConnected = $derived(
		!installationsQuery.isLoading && (installationsQuery.data?.length ?? 0) > 0
	);

	const repositories = $derived.by<Repository[]>(() => {
		if (reposQuery.data && reposQuery.data.length > 0) {
			return reposQuery.data;
		}
		return mockRepositories;
	});

	let apiErrors = $state<CreateProjectFieldErrors>({});

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Projects' },
		{ label: 'New Project', current: true }
	];

	function handleSelectRepository(_id: string, repo: Repository) {
		if (firstInstallationId) {
			wizard.selectGithubRepository(firstInstallationId, repo);
		}
	}

	function handleConnectGithub() {
		window.location.href = '/auth/github/install';
	}

	async function handleCreateProject(payload: StoreProjectRequest) {
		apiErrors = {};

		try {
			const project = await createMutation.mutateAsync(payload);
			await goto(resolve(`/projects/${project.id}`));
		} catch (err) {
			apiErrors = mapCreateProjectErrors(err);
		}
	}
</script>

<svelte:head>
	<title>Project Baru | Sakala Console</title>
</svelte:head>

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
						{repositories}
						{githubConnected}
						loading={installationsQuery.isLoading || reposQuery.isLoading}
						onNext={wizard.goToPrepareDeployment}
						onConnectGithub={handleConnectGithub}
						onSelectRepository={handleSelectRepository}
					/>
				{:else}
					<ConfigureProjectStep
						onSubmit={handleCreateProject}
						onRepositoryChange={wizard.backToSelectRepository}
						isSubmitting={createMutation.isPending}
						{apiErrors}
					/>
				{/if}
			{/if}
		</div>
	</div>
</div>
