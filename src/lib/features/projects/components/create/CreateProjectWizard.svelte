<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve, resolveRoute } from '$app/paths';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api/errors';
	import type { GetInstallationRepositoriesParams } from '$lib/api/resources/github';
	import type { StoreProjectRequest } from '$lib/api/resources/projects';
	import {
		githubConfigureUrl,
		githubInstallUrl,
		githubReconnectUrl,
		redirectToGithubInstall
	} from '$lib/features/auth/utils/oauth';
	import { getEnvironmentVariables } from '../../api';
	import { initCreateProjectContext } from '../../create/createProjectContext';
	import type { CreateIntent, WizardEnvVar } from '../../create/createProjectState.svelte';
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
	import ConfigureProjectStep from './ConfigureProjectStep.svelte';
	import CreateProjectStepper from './CreateProjectStepper.svelte';
	import EnvRetryStep from './EnvRetryStep.svelte';
	import FirstDeployStep from './FirstDeployStep.svelte';
	import RepositoryStep from './RepositoryStep.svelte';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';

	const REPOSITORIES_PER_PAGE = 5;
	/** Query parameters this wizard reads: the project it created, whether to deploy, an example. */
	const PROJECT_PARAM = 'project';
	const DEPLOY_PARAM = 'deploy';
	const EXAMPLE_PARAM = 'example';

	const installationResult = parseGithubInstallationResult(page.url.searchParams);

	const wizard = initCreateProjectContext();

	// A reload after the project was created must not bring the form back: submitting it again
	// would create a second project. The id in the URL is enough to pick up from step 3.
	const resumedProjectId = page.url.searchParams.get(PROJECT_PARAM);
	if (resumedProjectId) {
		wizard.resumeCreatedProject(resumedProjectId, {
			deploy: page.url.searchParams.get(DEPLOY_PARAM) === '1'
		});
	}
	const initialExampleId = resumedProjectId ? null : page.url.searchParams.get(EXAMPLE_PARAM);

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
	let createIntent: CreateIntent = 'deploy';

	/** "Buat tanpa deploy": the project page is where the project is read and deployed later. */
	function openCreatedProject() {
		const projectId = wizard.createdProjectId;
		if (projectId) void goto(resolveRoute('/(app)/projects/[id]', { id: projectId }));
	}

	function afterEnvSaved() {
		if (createIntent === 'create' && wizard.envSaveStatus === 'done') openCreatedProject();
	}

	function saveEnv(projectId: string, env: WizardEnvVar) {
		return addEnvMutation.mutateAsync({
			projectId,
			data: { key: env.key, value: env.value, is_secret: env.isSecret }
		});
	}

	async function handleCreateProject(payload: StoreProjectRequest, intent: CreateIntent) {
		if (creating) return;
		creating = true;
		createIntent = intent;
		apiErrors = {};

		try {
			// The personal workspace is the API's default, so only a team is named.
			const workspaceId = limitsWorkspaceId(targetWorkspace);
			const project = await createMutation.mutateAsync(
				workspaceId ? { ...payload, workspace_id: workspaceId } : payload
			);
			wizard.startEnvSave();
			wizard.markProjectCreated(project, { deploy: intent === 'deploy' });
			const query = `${PROJECT_PARAM}=${encodeURIComponent(project.id)}${intent === 'deploy' ? `&${DEPLOY_PARAM}=1` : ''}`;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus a query
			await goto(`${resolve('/projects/new')}?${query}`, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});

			const failures = await saveEnvVars([...wizard.envVars], {
				save: (env) => saveEnv(project.id, env),
				onSaved: () => wizard.markEnvSaved()
			});
			wizard.finishEnvSave(failures);
			afterEnvSaved();
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
			afterEnvSaved();
		} finally {
			retryingEnv = false;
		}
	}

	function handleDismissEnvFailures() {
		wizard.dismissEnvFailures();
		afterEnvSaved();
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
</script>

{#snippet picker(readOnly: boolean)}
	<WorkspacePicker
		workspaces={manageable}
		value={targetWorkspace?.id ?? null}
		limits={pilotLimits}
		onChange={(id) => (chosenWorkspaceId = id)}
		{readOnly}
	/>
{/snippet}

<!--
	The focused template: one centred column at reading width. The page title in the header already
	says "Proyek baru", so there is no breadcrumb repeating it.
-->
<FocusedPageLayout>
	<div class="w-full" bind:this={container}>
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
					onContinue={handleDismissEnvFailures}
				/>
			{:else if wizard.currentStep === 3 && wizard.createdProjectId}
				<FirstDeployStep
					projectId={wizard.createdProjectId}
					autoDeploy={wizard.deployAfterCreate}
					{pilotLimits}
				/>
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
						{@render picker(true)}
					{/snippet}
				</ConfigureProjectStep>
			{:else}
				{@render picker(false)}
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
					{initialExampleId}
				/>
			{/if}
		</div>
	</div>
</FocusedPageLayout>
