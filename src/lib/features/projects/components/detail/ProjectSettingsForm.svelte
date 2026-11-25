<script lang="ts">
	// The link to the other form page is a resolved route.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import ToggleField from '$lib/components/ui/ToggleField.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import {
		AUTO_DEPLOY_HELP,
		AUTO_DEPLOY_UNAVAILABLE_HELP,
		BUILD_COMMAND_HELP,
		DETECTED_PLACEHOLDER,
		PORT_HELP,
		RELEASE_COMMAND_DOCS_URL,
		RELEASE_COMMAND_EXAMPLE,
		RELEASE_COMMAND_HELP,
		RELEASE_COMMAND_LABEL,
		RELEASE_COMMAND_PLACEHOLDER,
		ROOT_DIRECTORY_HELP,
		ROOT_DIRECTORY_PLACEHOLDER,
		SETTINGS_FIELD_HINTS as HINTS,
		SETTINGS_LEARN_COPY as LEARN,
		START_COMMAND_HELP
	} from '../../build-help';
	import { createRepositoryBranchesQuery, type BranchSource } from '../../githubQueries';
	import { createProjectQuery } from '../../queries';
	import { createRequestInspectionMutation, createUpdateProjectMutation } from '../../mutations';
	import {
		createProjectDetailState,
		getProjectDetailContext,
		hasConfigErrors,
		projectConfigDraftFrom,
		projectConfigErrors,
		type ProjectConfigDraft,
		type ProjectConfigErrors,
		type ProjectConfigLimits
	} from '../../detail/projectDetailState.svelte';
	import { maxReplicasOf, MIN_REPLICAS, REPLICAS_COPY, replicasOf } from '../../replicas';
	import BranchCombobox from '../create/BranchCombobox.svelte';
	import ProjectReplicasField from './ProjectReplicasField.svelte';
	import { PANEL_COPY } from '$lib/components/panel/panel';
	import { SETTINGS_PANEL_COPY } from '../../settings-panel';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import {
		ADVANCED_ANCHORS,
		SETTINGS_ANCHORS,
		SETTINGS_PAGES,
		SETTINGS_SECTION_IDS as SECTION,
		dirtySettingsPages,
		settingsFormPageOf,
		settingsSectionOf,
		type SettingsFormPage
	} from '../../settings-anchors';
	import { settingsPageHref } from '../../overview/links';

	type Props = {
		projectId: string;
		/** Umum (name, branch, auto-deploy) or Build dan start (with Lanjutan). */
		formPage: SettingsFormPage;
	};

	let { projectId, formPage }: Props = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const access = useProjectAccess(() => projectQuery.data);
	const isGeneral = $derived(formPage === SETTINGS_PAGES.general);
	const otherPage = $derived<SettingsFormPage>(
		isGeneral ? SETTINGS_PAGES.build : SETTINGS_PAGES.general
	);
	const otherLabel = $derived(settingsSectionOf(otherPage).label);
	const updateMutation = createUpdateProjectMutation();
	const inspectMutation = createRequestInspectionMutation();

	// The draft lives in the project layout, so it outlasts this component across tab switches and
	// across the two form pages: Save on either sends every change, and says so.
	const draft = getProjectDetailContext() ?? createProjectDetailState();
	const otherPageDirty = $derived(dirtySettingsPages(draft.changedFields).has(otherPage));

	const originalName = $derived(projectQuery.data?.name ?? projectQuery.data?.project_name ?? '');
	const originalBranch = $derived(projectQuery.data?.branch ?? '');

	const name = $derived(draft.draftName ?? originalName);
	const branch = $derived(draft.draftBranch ?? originalBranch);

	const originalConfig = $derived(
		projectQuery.data ? projectConfigDraftFrom(projectQuery.data) : null
	);
	const config = $derived(draft.draftConfig ?? originalConfig);
	const configLimits = $derived<ProjectConfigLimits | null>(
		projectQuery.data ? { maxReplicas: maxReplicasOf(projectQuery.data) } : null
	);
	const isGithubInstallation = $derived(
		projectQuery.data?.repository_source === 'github_installation'
	);

	const branchSource = $derived.by<BranchSource | null>(() => {
		const project = projectQuery.data;
		if (!project) return null;
		if (project.github_installation_id && project.github_repository_id) {
			return {
				kind: 'installation',
				installationId: project.github_installation_id,
				repositoryId: String(project.github_repository_id)
			};
		}
		return project.repository_url
			? { kind: 'public', repositoryUrl: project.repository_url }
			: null;
	});
	const branchesQuery = createRepositoryBranchesQuery(() => branchSource);
	const branchOptions = $derived.by(() => {
		const fetched = branchesQuery.data ?? [];
		return originalBranch && !fetched.includes(originalBranch)
			? [originalBranch, ...fetched]
			: fetched;
	});

	let configErrors = $state<ProjectConfigErrors>({});
	/** Set when a field on the other form page holds what stopped the save. */
	let otherPageError = $state(false);

	/** The fields of the Lanjutan section, which changes rarely and can stop a deployment. */
	const ADVANCED_FIELDS: readonly (keyof ProjectConfigDraft)[] = ['release_command', 'replicas'];
	const hasAdvancedValue = (values: ProjectConfigDraft | null) =>
		Boolean(values?.release_command.trim()) ||
		Number(values?.replicas ?? MIN_REPLICAS) > MIN_REPLICAS;

	/**
	 * Null until someone opens or closes it. Until then it is open only when it already holds a
	 * value, so a release command or extra replicas are never hidden from the person reading.
	 */
	let advancedOpen = $state<boolean | null>(null);
	const hasAdvancedError = $derived(ADVANCED_FIELDS.some((field) => Boolean(configErrors[field])));
	const advancedVisible = $derived(
		hasAdvancedError ||
			(advancedOpen ?? (hasAdvancedValue(originalConfig) || hasAdvancedValue(config)))
	);

	/** Not state: only the arrival at an anchor matters, not every refetch afterwards. */
	let handledHash = '';
	// Arriving at a field in Lanjutan (the overview's "Atur release command") opens it and scrolls
	// there, which the browser could not do while the field was hidden. It is set once rather than
	// derived from the hash, so following the link to another section does not fold it away again.
	$effect(() => {
		const target = page.url.hash.slice(1);
		if (!projectQuery.data || !target || target === handledHash) return;
		handledHash = target;
		if (ADVANCED_ANCHORS.includes(target)) advancedOpen = true;
		void tick().then(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
	});

	let nameError = $state('');
	let branchError = $state('');
	let formError = $state('');
	let saveMessage = $state('');

	/** Whether an error from validation or the API sits on a field of the other form page. */
	function errorsOnOtherPage(): boolean {
		const fields = [
			...(nameError ? ['name'] : []),
			...(branchError ? ['branch'] : []),
			...Object.entries(configErrors)
				.filter(([, message]) => Boolean(message))
				.map(([field]) => field)
		];
		return fields.some((field) => settingsFormPageOf(field) === otherPage);
	}

	function updateDraft(nextName: string, nextBranch: string) {
		draft.setDraft(nextName, nextBranch, originalName, originalBranch);
		// Back to the saved values: no draft, so a later server update reaches these fields.
		if (nextName === originalName && nextBranch === originalBranch) draft.resetDraft();
		saveMessage = '';
	}

	function setName(next: string) {
		nameError = '';
		formError = '';
		updateDraft(next, branch);
	}

	function setBranch(next: string) {
		branchError = '';
		formError = '';
		updateDraft(name, next);
	}

	function updateConfig(patch: Partial<ProjectConfigDraft>) {
		if (!config || !originalConfig || !configLimits) return;
		draft.setConfigDraft({ ...config, ...patch }, originalConfig, configLimits);
		for (const field of Object.keys(patch) as (keyof ProjectConfigDraft)[]) {
			configErrors[field] = undefined;
			// Emptying a field must not fold the section away under the cursor.
			if (ADVANCED_FIELDS.includes(field)) advancedOpen = true;
		}
		formError = '';
		saveMessage = '';
	}

	function validateConfig(): boolean {
		if (!config || !originalConfig || !configLimits) return true;
		configErrors = projectConfigErrors(config, originalConfig, configLimits);
		return !hasConfigErrors(configErrors);
	}

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let saving = false;

	function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (!draft.isDirty || saving) return;

		const trimmedName = name.trim();
		const trimmedBranch = branch.trim();

		nameError = trimmedName ? '' : 'Isi nama proyek. Nama ini tampil di daftar proyek.';
		branchError = trimmedBranch ? '' : 'Isi nama branch yang akan dideploy, misalnya main.';
		formError = '';
		const configValid = validateConfig();
		otherPageError = errorsOnOtherPage();
		if (nameError || branchError || !configValid) return;

		const configPayload = draft.configPayload();
		const rootDirectoryChanged = 'root_directory' in configPayload;
		const buildChanged = Object.keys(configPayload).some((field) => field !== 'auto_deploy');

		saving = true;
		otherPageError = false;
		updateMutation.mutate(
			{
				id: projectId,
				data: {
					...(trimmedName !== originalName.trim() ? { name: trimmedName } : {}),
					...(trimmedBranch !== originalBranch.trim() ? { branch: trimmedBranch } : {}),
					...configPayload
				}
			},
			{
				onSuccess: () => {
					draft.resetDraft();
					saveMessage = buildChanged
						? 'Perubahan tersimpan. Berlaku mulai deployment berikutnya.'
						: 'Perubahan tersimpan.';
					// The stack on record described the old folder, and the API drops it until asked again.
					if (rootDirectoryChanged) {
						inspectMutation.mutate(projectId, {
							onError: () => {
								saveMessage =
									'Perubahan tersimpan, tapi deteksi ulang untuk folder baru belum berjalan. Berlaku mulai deployment berikutnya.';
							}
						});
					}
				},
				onError: (error) => {
					if (error instanceof ApiError && error.isValidationError) {
						nameError = error.errors.name?.[0] ?? '';
						branchError = error.errors.branch?.[0] ?? '';
						configErrors = {
							configured_port: error.errors.configured_port?.[0],
							build_command: error.errors.build_command?.[0],
							start_command: error.errors.start_command?.[0],
							release_command: error.errors.release_command?.[0],
							root_directory: error.errors.root_directory?.[0],
							replicas: error.errors.replicas?.[0]
						};
						otherPageError = errorsOnOtherPage();
						if (nameError || branchError || hasConfigErrors(configErrors)) return;
					}
					formError = getErrorMessage(
						error,
						'Perubahan pengaturan belum tersimpan. Muat ulang halaman, lalu simpan lagi.'
					);
				},
				onSettled: () => {
					saving = false;
				}
			}
		);
	}
</script>

{#snippet configField(
	id: string,
	label: string,
	field: Exclude<keyof ProjectConfigDraft, 'auto_deploy' | 'replicas'>,
	placeholder: string,
	hint: string,
	options: { mono?: boolean; numeric?: boolean } = {}
)}
	<FormField
		{id}
		{label}
		{placeholder}
		{hint}
		inputmode={options.numeric ? 'numeric' : 'text'}
		spellcheck={false}
		inputClass={options.mono ? 'font-mono' : undefined}
		bind:value={
			() => config?.[field]?.toString() ?? '', (value) => updateConfig({ [field]: value })
		}
		error={configErrors[field]}
	/>
{/snippet}

{#snippet learnRow(term: string, explanation: string)}
	<div>
		<dt class="font-medium text-foreground">{term}</dt>
		<dd>{explanation}</dd>
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	{#if projectQuery.isLoading}
		<div class="p-6 text-center text-sm text-muted">Memuat pengaturan...</div>
	{:else if projectQuery.isError}
		<div class="p-6 text-center text-sm text-error">Gagal memuat data pengaturan proyek.</div>
	{:else if projectQuery.data && access.readOnly}
		{@const data = projectQuery.data}
		{@const facts = isGeneral
			? [
					['Nama proyek', data.name ?? data.project_name],
					['Branch', data.branch],
					['Subdomain', data.slug],
					['Auto-deploy', data.auto_deploy ? 'Aktif' : 'Tidak aktif']
				]
			: [
					['Root directory', data.root_directory || 'Root repository'],
					['Port', String(data.configured_port ?? data.effective_port)],
					['Build command', data.build_command || 'Dideteksi otomatis'],
					['Start command', data.start_command || 'Dideteksi otomatis'],
					[RELEASE_COMMAND_LABEL, data.release_command || 'Tidak ada'],
					[REPLICAS_COPY.label, String(replicasOf(data))]
				]}
		<!-- A viewer gets the settings as facts, without a form that the API would refuse. -->
		<section class="surface-card flex flex-col gap-4 p-4 sm:p-6" data-testid="settings-read-only">
			<p class="text-sm text-muted">
				Pengaturan proyek hanya bisa diubah pemilik dan anggota workspace.
			</p>
			<dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
				{#each facts as [label, value] (label)}
					<dt class="text-muted">{label}</dt>
					<dd class="min-w-0 font-mono wrap-anywhere text-foreground">{value}</dd>
				{/each}
			</dl>
		</section>
	{:else if projectQuery.data}
		<form onsubmit={handleSave} novalidate class="surface-card flex flex-col p-4 sm:p-6">
			{#if isGeneral}
				<section
					id={SECTION.general}
					aria-labelledby="{SECTION.general}-title"
					class="flex scroll-mt-4 flex-col gap-5"
				>
					<h2
						id="{SECTION.general}-title"
						class="font-sans text-base font-semibold text-foreground"
					>
						Umum
					</h2>
					<FormField
						id="projectName"
						label="Nama proyek"
						placeholder="Nama proyek"
						required
						bind:value={() => name, setName}
						error={nameError}
					/>

					<div class="space-y-1.5">
						<label for="branch" class="block text-sm font-medium text-foreground">Branch</label>
						{#key branchSource}
							<BranchCombobox
								id="branch"
								value={branch}
								branches={branchOptions}
								loading={branchesQuery.isPending && branchSource !== null}
								allowOther
								invalid={Boolean(branchError)}
								describedBy={branchError ? 'branch-error' : undefined}
								onValueChange={setBranch}
							/>
						{/key}
						{#if branchError}
							<p id="branch-error" class="text-xs text-error-base">{branchError}</p>
						{/if}
					</div>

					<!-- The overview's next steps link here, so the anchor id stays as it is. -->
					<div id={SETTINGS_ANCHORS.autoDeploy} class="-my-3 scroll-mt-4">
						<ToggleField
							title="Auto-deploy"
							description={isGithubInstallation ? HINTS.autoDeploy : HINTS.autoDeployUnavailable}
							checked={isGithubInstallation && (config?.auto_deploy ?? false)}
							disabled={!isGithubInstallation}
							onToggle={() => updateConfig({ auto_deploy: !config?.auto_deploy })}
						/>
					</div>

					<LearnMore topic="auto-deploy">
						<p>{isGithubInstallation ? AUTO_DEPLOY_HELP : AUTO_DEPLOY_UNAVAILABLE_HELP}</p>
					</LearnMore>
				</section>
			{:else}
				<section
					id={SECTION.build}
					aria-labelledby="{SECTION.build}-title"
					class="flex scroll-mt-4 flex-col gap-5"
				>
					<h2 id="{SECTION.build}-title" class="font-sans text-base font-semibold text-foreground">
						Build dan start
					</h2>
					{@render configField(
						'rootDirectory',
						'Root directory',
						'root_directory',
						ROOT_DIRECTORY_PLACEHOLDER,
						HINTS.rootDirectory,
						{ mono: true }
					)}
					{@render configField(
						'port',
						'Port',
						'configured_port',
						DETECTED_PLACEHOLDER,
						HINTS.port(projectQuery.data.effective_port),
						{ numeric: true }
					)}
					{@render configField(
						'buildCommand',
						'Build command',
						'build_command',
						DETECTED_PLACEHOLDER,
						HINTS.buildCommand,
						{ mono: true }
					)}
					{@render configField(
						'startCommand',
						'Start command',
						'start_command',
						DETECTED_PLACEHOLDER,
						HINTS.startCommand,
						{ mono: true }
					)}
					<LearnMore topic="build dan start" testid="build-learn-more">
						<dl class="flex flex-col gap-2">
							{@render learnRow(LEARN.emptyTerm, LEARN.empty)}
							{@render learnRow('Root directory', ROOT_DIRECTORY_HELP)}
							{@render learnRow('Port', PORT_HELP)}
							{@render learnRow('Build command', BUILD_COMMAND_HELP)}
							{@render learnRow('Start command', START_COMMAND_HELP)}
							{@render learnRow(LEARN.appliesTerm, LEARN.applies)}
						</dl>
					</LearnMore>
				</section>

				<!-- Closed unless it holds a value: both fields are rare, and either can stop a deployment. -->
				<section
					id={SECTION.advanced}
					aria-labelledby="{SECTION.advanced}-title"
					class="mt-6 scroll-mt-4 border-t border-border pt-4"
				>
					<h2
						id="{SECTION.advanced}-title"
						class="font-sans text-base font-semibold text-foreground"
					>
						<button
							type="button"
							class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left lg:min-h-control-md"
							aria-expanded={advancedVisible}
							aria-controls="{SECTION.advanced}-fields"
							onclick={() => (advancedOpen = !advancedVisible)}
						>
							<span>Lanjutan</span>
							<CaretDown
								size={16}
								class={advancedVisible ? 'shrink-0 rotate-180' : 'shrink-0'}
								aria-hidden="true"
							/>
						</button>
					</h2>
					<p class="text-sm text-foreground/70">{RELEASE_COMMAND_LABEL} dan replika.</p>
					<div
						id="{SECTION.advanced}-fields"
						class="mt-5 flex flex-col gap-5"
						hidden={!advancedVisible}
					>
						{@render configField(
							SETTINGS_ANCHORS.releaseCommand,
							RELEASE_COMMAND_LABEL,
							'release_command',
							RELEASE_COMMAND_PLACEHOLDER,
							HINTS.releaseCommand,
							{ mono: true }
						)}

						{#if config && configLimits}
							<ProjectReplicasField
								value={config.replicas}
								maxReplicas={configLimits.maxReplicas}
								error={configErrors.replicas}
								onValueChange={(value) => updateConfig({ replicas: value })}
							/>
						{/if}
						<LearnMore topic="release command dan replika" testid="advanced-learn-more">
							<dl class="flex flex-col gap-2">
								{@render learnRow(
									RELEASE_COMMAND_LABEL,
									`${RELEASE_COMMAND_HELP} ${RELEASE_COMMAND_EXAMPLE}`
								)}
								{@render learnRow(
									REPLICAS_COPY.label,
									configLimits && configLimits.maxReplicas > MIN_REPLICAS
										? REPLICAS_COPY.help
										: `${REPLICAS_COPY.help} ${REPLICAS_COPY.unavailable}`
								)}
							</dl>
							<a
								href={RELEASE_COMMAND_DOCS_URL}
								target="_blank"
								rel="external noopener noreferrer"
								class="inline-flex min-h-6 items-center self-start font-medium text-primary-dark underline underline-offset-2"
								>{LEARN.releaseGuide}<span class="sr-only">&nbsp;{PANEL_COPY.newTab}</span></a
							>
						</LearnMore>
					</div>
				</section>
			{/if}

			<div class="mt-6 flex flex-col gap-4 border-t border-border pt-6">
				<div class="flex flex-wrap items-center justify-end gap-3">
					{#if formError}
						<p role="alert" class="mr-auto text-sm text-error-dark">{formError}</p>
					{:else if otherPageError}
						<p
							role="alert"
							class="mr-auto text-sm text-error-dark"
							data-testid="settings-other-page-error"
						>
							<a
								href={settingsPageHref(projectId, otherPage)}
								class="font-medium underline underline-offset-2"
								>{SETTINGS_PANEL_COPY.fixOn(otherLabel)}</a
							>
						</p>
					{:else if otherPageDirty}
						<p class="mr-auto text-sm text-foreground/70" data-testid="settings-also-saves">
							{SETTINGS_PANEL_COPY.alsoSaves(otherLabel)}
						</p>
					{/if}
					<span role="status" class="text-sm text-foreground/70">{saveMessage}</span>
					<Button
						type="submit"
						disabled={!draft.isDirty || updateMutation.isPending}
						aria-busy={updateMutation.isPending}
					>
						{#if updateMutation.isPending}
							<CircleNotch
								size={16}
								weight="bold"
								class="animate-spin motion-reduce:animate-none"
								aria-hidden="true"
							/>
						{/if}
						Simpan perubahan
					</Button>
				</div>
			</div>
		</form>
	{/if}
</div>
