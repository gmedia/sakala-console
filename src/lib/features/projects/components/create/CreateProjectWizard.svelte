<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/errors';
	import type { GetInstallationRepositoriesParams } from '$lib/api/resources/github';
	import type { StoreProjectRequest } from '$lib/api/resources/projects';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import type { BreadCrumbItem } from '$lib/components/ui/Breadcrumb.svelte';
	import {
		githubConfigureUrl,
		githubInstallUrl,
		githubReconnectUrl,
		redirectToGithubInstall
	} from '$lib/features/auth/utils/oauth';
	import { getEnvironmentVariables } from '../../api';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import type { WizardEnvVar } from '../../create/createProjectState.svelte';
	import { saveEnvVars, withoutAlreadySaved } from '../../create/save-env-vars';
	import { parseGithubInstallationResult } from '../../github-installation-result';
	import {
		createGithubInstallationsQuery,
		createInstallationRepositoriesQuery
	} from '../../githubQueries';
	import {
		createAddEnvironmentVariableMutation,
		createProjectMutation,
		createValidateGithubRepositoryMutation
	} from '../../mutations';
	import { isProjectQuotaReached } from '../../presentation';
	import { useActiveWorkspace } from '$lib/features/workspaces/access.svelte';
	import WorkspacePicker from '$lib/features/workspaces/components/WorkspacePicker.svelte';
	import { canManageProjects, limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import type { Repository } from '../../type';
	import {
		mapCreateProjectErrors,
		type CreateProjectFieldErrors
	} from '../../validation/createProjectSchema';
	import AutoDetectStep from './AutoDetectStep.svelte';
	import CancelCreateProjectAction from './CancelCreateProjectAction.svelte';
	import ConfigureProjectStep from './ConfigureProjectStep.svelte';
	import CreateProjectStepper from './CreateProjectStepper.svelte';
	import EnvRetryStep from './EnvRetryStep.svelte';
	import RepositoryStep from './RepositoryStep.svelte';

	const REPOSITORIES_PER_PAGE = 5;

	const installationResult = parseGithubInstallationResult(page.url.searchParams);

	const wizard = initCreateProjectContext();

	// A reload after the project was created must not bring the form back: submitting it again
	// would create a second project. The id in the URL is enough to pick up from step 3.
	const resumedProjectId = page.url.searchParams.get('project');
	if (resumedProjectId) wizard.resumeCreatedProject(resumedProjectId);

	// The result stays on screen; the query goes, so a refresh does not show it again.
	onMount(() => {
		if (installationResult) {
			void goto(resolve('/projects/new'), { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	// The project goes to the active workspace when the user may create there, otherwise to the
	// personal one. A choice made here is kept for this wizard only.
	const workspaces = useActiveWorkspace();
	const manageable = $derived(workspaces.workspaces.filter((item) => canManageProjects(item.role)));
	let chosenWorkspaceId = $state<string | null>(null);
	const targetWorkspace = $derived(
		manageable.find((item) => item.id === chosenWorkspaceId) ??
			(workspaces.active && canManageProjects(workspaces.active.role)
				? workspaces.active
				: manageable.find((item) => item.type === 'personal')) ??
			null
	);

	const pilotLimitsQuery = createWorkspaceLimitsQuery(() => limitsWorkspaceId(targetWorkspace));
	const pilotLimits = $derived(pilotLimitsQuery.data);
	const atQuota = $derived(isProjectQuotaReached(pilotLimits?.quotas));

	const createMutation = createProjectMutation();
	const validateMutation = createValidateGithubRepositoryMutation();
	const addEnvMutation = createAddEnvironmentVariableMutation();

	const installationsQuery = createGithubInstallationsQuery();
	const installations = $derived(installationsQuery.data ?? []);

	// One the user picked, otherwise the first that works: an inactive one only answers 409.
	const installationId = $derived(
		wizard.selectedInstallationId ??
			installations.find((installation) => installation.status === 'active')?.id ??
			installations[0]?.id ??
			null
	);
	const installation = $derived(installations.find((item) => item.id === installationId) ?? null);

	let repositoryPage = $state(1);
	let repositorySearch = $state('');

	const repositoryParams = $derived<GetInstallationRepositoriesParams>({
		page: repositoryPage,
		per_page: REPOSITORIES_PER_PAGE,
		...(repositorySearch.trim() && { search: repositorySearch.trim() })
	});

	const reposQuery = createInstallationRepositoriesQuery(
		() => (wizard.currentStep === 1 ? installationId : null),
		() => repositoryParams
	);

	const githubConnected = $derived(!installationsQuery.isLoading && installations.length > 0);
	const repositories = $derived<Repository[]>(reposQuery.data?.data ?? []);

	const installationInactive = $derived(
		reposQuery.error instanceof ApiError && reposQuery.error.status === 409
	);

	const reposErrorMessage = $derived.by(() => {
		const err = installationsQuery.error || reposQuery.error;
		if (!err) return null;

		if (err instanceof ApiError) {
			if (err.isGithubRateLimited) return err.message;
			if (err.status === 409) {
				const account = installation?.account_login ?? 'ini';
				return `Instalasi GitHub ${account} sudah tidak aktif, jadi repository-nya tidak bisa dibaca. Hubungkan ulang supaya Sakala bisa membacanya lagi.`;
			}
			if (err.status === 403) {
				return 'Kamu tidak memiliki akses ke instalasi GitHub ini.';
			}
		}

		if (installationsQuery.isError) {
			return 'Gagal memuat instalasi GitHub. Silakan coba beberapa saat lagi.';
		}
		return 'Gagal memuat daftar repository GitHub. Silakan coba beberapa saat lagi.';
	});

	function handleRetryRepos() {
		if (installationsQuery.isError) void installationsQuery.refetch();
		if (reposQuery.isError) void reposQuery.refetch();
	}

	function handleSearch(search: string) {
		repositorySearch = search;
		repositoryPage = 1;
	}

	function handleInstallationChange(id: string) {
		wizard.selectedInstallationId = id;
		repositoryPage = 1;
	}

	async function handleValidateGitUrl(url: string): Promise<Repository> {
		const result = await validateMutation.mutateAsync(url);
		return {
			id: String(result.id),
			name: result.name,
			full_name: result.full_name,
			clone_url: result.clone_url,
			default_branch: result.default_branch,
			pushed_at: result.pushed_at,
			private: result.private
		};
	}

	let apiErrors = $state<CreateProjectFieldErrors>({});
	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let creating = false;

	function saveEnv(projectId: string, env: WizardEnvVar) {
		return addEnvMutation.mutateAsync({
			projectId,
			data: { key: env.key, value: env.value, is_secret: env.isSecret }
		});
	}

	async function handleCreateProject(payload: StoreProjectRequest) {
		if (creating) return;
		creating = true;
		apiErrors = {};

		try {
			// The personal workspace is the API's default, so only a team is named.
			const workspaceId = limitsWorkspaceId(targetWorkspace);
			const project = await createMutation.mutateAsync(
				workspaceId ? { ...payload, workspace_id: workspaceId } : payload
			);
			wizard.startEnvSave();
			wizard.markProjectCreated(project);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a query
			await goto(`${resolve('/projects/new')}?project=${encodeURIComponent(project.id)}`, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});

			const failures = await saveEnvVars([...wizard.envVars], {
				save: (env) => saveEnv(project.id, env),
				onSaved: () => wizard.markEnvSaved()
			});
			wizard.finishEnvSave(failures);
		} catch (err) {
			// Only a failed create lands here on step 2; a variable never makes the project fail.
			if (!wizard.createdProjectId) apiErrors = mapCreateProjectErrors(err);
		} finally {
			creating = false;
		}
	}

	let retryingEnv = $state(false);

	async function handleRetryEnv() {
		const projectId = wizard.createdProjectId;
		if (retryingEnv || !projectId) return;
		retryingEnv = true;

		try {
			const pending = [...wizard.envFailures];
			const existing = await getEnvironmentVariables(projectId).catch(() => []);
			const remaining = withoutAlreadySaved(
				pending,
				existing.map((env) => env.key)
			);
			const alreadySaved = pending.length - remaining.length;
			for (let i = 0; i < alreadySaved; i++) wizard.markEnvSaved();

			const failures = await saveEnvVars(
				remaining.map((failure) => failure.env),
				{
					save: (env) => saveEnv(projectId, env),
					onSaved: () => wizard.markEnvSaved()
				}
			);
			wizard.finishEnvSave(failures);
		} finally {
			retryingEnv = false;
		}
	}

	const showEnvStep = $derived(
		wizard.envSaveStatus === 'saving' || wizard.envSaveStatus === 'partial'
	);
	const stepperStep = $derived(showEnvStep ? 2 : wizard.currentStep);

	const stepKey = $derived(`${wizard.currentStep}-${wizard.envSaveStatus}`);
	let container = $state<HTMLDivElement>();
	let lastStepKey: string | undefined;
	// Moving on replaces the focused button, and focus would otherwise fall back to the body.
	$effect(() => {
		const key = stepKey;
		if (lastStepKey !== undefined && lastStepKey !== key) {
			void tick().then(() => container?.querySelector<HTMLElement>('[data-step-heading]')?.focus());
		}
		lastStepKey = key;
	});

	const itemsBreadcrumb: BreadCrumbItem[] = [
		{ label: 'Proyek' },
		{ label: 'Proyek baru', current: true }
	];
</script>

{#snippet picker()}
	<WorkspacePicker
		workspaces={manageable}
		value={targetWorkspace?.id ?? null}
		limits={pilotLimits}
		onChange={(id) => (chosenWorkspaceId = id)}
	/>
{/snippet}

<div class="flex flex-col items-center justify-center">
	<div class="flex w-full items-center justify-between">
		<Breadcrumb items={itemsBreadcrumb} class="mb-4 font-semibold" />
		<CancelCreateProjectAction />
	</div>

	<div class="w-full max-w-2xl" bind:this={container}>
		<CreateProjectStepper currentStep={stepperStep} />

		<div class="mx-2 mt-4 flex flex-col gap-2">
			{#if installationResult?.kind === 'connected'}
				<p
					class="rounded-control border border-primary/30 bg-primary-50 p-3 text-sm text-foreground"
					role="status"
				>
					{installationResult.message}
				</p>
			{:else if installationResult?.kind === 'error'}
				<p
					class="rounded-control border border-error/30 bg-error/10 p-3 text-sm text-foreground"
					role="alert"
				>
					{installationResult.message}
				</p>
			{/if}

			{#if showEnvStep}
				<EnvRetryStep
					retrying={retryingEnv}
					onRetry={handleRetryEnv}
					onContinue={wizard.dismissEnvFailures}
				/>
			{:else if wizard.currentStep === 3 && wizard.createdProjectId}
				<AutoDetectStep projectId={wizard.createdProjectId} {pilotLimits} />
			{:else if wizard.currentStep === 2}
				<ConfigureProjectStep
					onSubmit={handleCreateProject}
					onRepositoryChange={wizard.backToSelectRepository}
					isSubmitting={createMutation.isPending}
					{apiErrors}
					{pilotLimits}
					reconnectUrl={githubReconnectUrl(installation)}
				>
					{#snippet workspacePicker()}
						{@render picker()}
					{/snippet}
				</ConfigureProjectStep>
			{:else}
				{@render picker()}
				<RepositoryStep
					{repositories}
					{githubConnected}
					loading={installationsQuery.isLoading || reposQuery.isLoading}
					fetching={reposQuery.isFetching}
					errorMessage={reposErrorMessage}
					reconnectUrl={installationInactive ? githubReconnectUrl(installation) : null}
					onRetry={handleRetryRepos}
					onNext={wizard.goToPrepareDeployment}
					onConnectGithub={redirectToGithubInstall}
					onSelectRepository={(_id, repo) => {
						if (installationId) wizard.selectGithubRepository(installationId, repo);
					}}
					onValidateGitUrl={handleValidateGitUrl}
					{installations}
					{installationId}
					onInstallationChange={handleInstallationChange}
					configureUrl={installationId ? githubConfigureUrl(installationId) : null}
					addAccountUrl={githubInstallUrl()}
					total={reposQuery.data?.meta.total}
					currentPage={reposQuery.data?.meta.current_page ?? repositoryPage}
					lastPage={reposQuery.data?.meta.last_page ?? 1}
					onPageChange={(next) => (repositoryPage = next)}
					search={repositorySearch}
					onSearch={handleSearch}
					blocked={atQuota}
				/>
			{/if}
		</div>
	</div>
</div>
