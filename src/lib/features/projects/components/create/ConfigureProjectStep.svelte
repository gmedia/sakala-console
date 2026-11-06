<script lang="ts">
	import { tick } from 'svelte';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import WarningCircleIcon from 'phosphor-svelte/lib/WarningCircleIcon';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import type { StoreProjectRequest } from '$lib/api/resources/projects';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import ToggleField from '$lib/components/ui/ToggleField.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import {
		buildConfigurationSchema,
		createProjectFormSchema,
		type CreateProjectFieldErrors
	} from '../../validation/createProjectSchema';
	import { createRepositoryBranchesQuery, type BranchSource } from '../../githubQueries';
	import { formatPilotRuntime, isProjectQuotaReached } from '../../presentation';
	import { createDomainPreviewQuery } from '../../queries';
	import {
		AUTO_DEPLOY_HELP,
		AUTO_DEPLOY_UNAVAILABLE_HELP,
		BUILD_COMMAND_HELP,
		ROOT_DIRECTORY_HELP,
		START_COMMAND_HELP
	} from '../../build-help';
	import BranchCombobox from './BranchCombobox.svelte';
	import PilotQuotaNotice from './PilotQuotaNotice.svelte';
	import WizardEnvEditor from './WizardEnvEditor.svelte';

	type Props = {
		onSubmit: (payload: StoreProjectRequest) => void;
		onRepositoryChange: () => void;
		isSubmitting?: boolean;
		apiErrors?: CreateProjectFieldErrors;
		pilotLimits?: PilotLimits;
		reconnectUrl?: string | null;
	};

	let {
		onSubmit,
		onRepositoryChange,
		isSubmitting = false,
		apiErrors = {},
		pilotLimits,
		reconnectUrl = null
	}: Props = $props();

	const wizard = getCreateProjectContext();

	/** The API cuts the list of an installation's branches at 100, a public repository's it does not. */
	const INSTALLATION_BRANCH_LIMIT = 100;
	const PREVIEW_DEBOUNCE_MS = 300;

	let formEl = $state<HTMLFormElement>();
	let envEditor = $state<WizardEnvEditor>();
	let submitted = $state(false);
	let nameTouched = $state(false);

	const isGithub = $derived(wizard.repositorySource === 'github');
	const repo = $derived(wizard.selectedRepository);

	const branchSource = $derived.by<BranchSource | null>(() => {
		if (!repo) return null;
		if (isGithub && wizard.selectedInstallationId) {
			return {
				kind: 'installation',
				installationId: wizard.selectedInstallationId,
				repositoryId: repo.id
			};
		}
		return isGithub ? null : { kind: 'public', repositoryUrl: wizard.gitUrl.trim() };
	});
	const branchesQuery = createRepositoryBranchesQuery(() => branchSource);

	// The default branch is a fact from the repository, even when the list failed or was cut off.
	const branchOptions = $derived.by(() => {
		const fetched = branchesQuery.data ?? [];
		const known = repo?.default_branch;
		return known && !fetched.includes(known) ? [known, ...fetched] : fetched;
	});
	const branchesCutOff = $derived(
		isGithub && (branchesQuery.data?.length ?? 0) >= INSTALLATION_BRANCH_LIMIT
	);
	const branchesInactive = $derived(
		branchesQuery.error instanceof ApiError && branchesQuery.error.status === 409
	);
	const branchesErrorMessage = $derived.by(() => {
		if (!branchesQuery.isError) return null;
		const fallback = repo?.default_branch
			? `Yang terpilih sekarang branch default repository, ${repo.default_branch}.`
			: 'Coba muat ulang daftarnya.';
		if (branchesInactive) {
			return `Instalasi GitHub ini sudah tidak aktif, jadi daftar branch tidak bisa dimuat. ${fallback}`;
		}
		const message =
			getFieldError(branchesQuery.error, 'repository_url') ??
			getErrorMessage(branchesQuery.error, 'Daftar branch belum bisa dimuat.');
		return `${message} ${fallback}`;
	});

	const repositoryPayload = $derived.by(() => {
		const numericId = Number(repo?.id);
		if (isGithub && wizard.selectedInstallationId && numericId > 0) {
			return {
				type: 'github_installation' as const,
				installation_id: wizard.selectedInstallationId,
				repository_id: numericId
			};
		}
		return {
			type: 'public_url' as const,
			url: isGithub ? (repo?.clone_url?.replace(/\.git$/, '') ?? '') : wizard.gitUrl.trim()
		};
	});

	const basicsResult = $derived(
		createProjectFormSchema.safeParse({
			name: wizard.projectName,
			branch: wizard.selectedBranch,
			repository: repositoryPayload
		})
	);
	const configurationResult = $derived(
		buildConfigurationSchema.safeParse({
			configured_port: wizard.configuredPort,
			build_command: wizard.buildCommand,
			start_command: wizard.startCommand,
			root_directory: wizard.rootDirectory
		})
	);
	const clientErrors = $derived({
		...(basicsResult.success ? {} : basicsResult.error.flatten().fieldErrors),
		...(configurationResult.success ? {} : configurationResult.error.flatten().fieldErrors)
	} as Partial<Record<keyof CreateProjectFieldErrors, string[]>>);

	function fieldError(field: keyof CreateProjectFieldErrors, touched = submitted) {
		return (touched ? clientErrors[field]?.[0] : undefined) ?? apiErrors[field];
	}

	let debouncedName = $state('');
	$effect(() => {
		const name = wizard.projectName;
		const timer = setTimeout(() => (debouncedName = name), PREVIEW_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	});
	const previewQuery = createDomainPreviewQuery(() => debouncedName);
	const previewIsCurrent = $derived(debouncedName === wizard.projectName);
	// A reserved name answers 422 on `name`. It is the only message here the user can act on.
	const previewNameError = $derived(getFieldError(previewQuery.error, 'name'));
	const nameError = $derived(fieldError('name', submitted || nameTouched) ?? previewNameError);

	const previewText = $derived.by(() => {
		if (!wizard.projectName.trim()) return 'Isi nama proyek untuk melihat domainnya.';
		if (!previewIsCurrent || previewQuery.isFetching) return 'Memeriksa domain...';
		if (previewQuery.data) return previewQuery.data.domain;
		if (previewNameError) return 'Nama ini tidak bisa dipakai.';
		return 'Domain belum bisa dipratinjau.';
	});

	const atQuota = $derived(isProjectQuotaReached(pilotLimits?.quotas));

	async function focusFirstError() {
		await tick();
		formEl?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;

		const envReady = envEditor?.flushDraft() ?? true;
		if (!envReady || !basicsResult.success || !configurationResult.success || previewNameError) {
			void focusFirstError();
			return;
		}

		const { name, branch, repository } = basicsResult.data;
		const configuration = configurationResult.data;

		onSubmit({
			name,
			branch,
			repository,
			...(configuration.configured_port !== null && {
				configured_port: configuration.configured_port
			}),
			...(configuration.build_command && { build_command: configuration.build_command }),
			...(configuration.start_command && { start_command: configuration.start_command }),
			...(configuration.root_directory && { root_directory: configuration.root_directory }),
			...(isGithub && wizard.autoDeploy && { auto_deploy: true })
		});
	}

	$effect(() => {
		if (Object.keys(apiErrors).length > 0) void focusFirstError();
	});
</script>

<form bind:this={formEl} class="mt-3 flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
	<div>
		<h2 tabindex="-1" data-step-heading class="text-xl outline-none">Persiapan deployment</h2>
		<p>Atur konfigurasi proyek sebelum dibuat.</p>
	</div>

	<PilotQuotaNotice limits={pilotLimits} />

	{#if apiErrors.general}
		<div
			class="flex items-start gap-3 rounded-control border border-error/30 bg-error/10 p-4 text-error-dark"
			role="alert"
		>
			<WarningCircleIcon class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
			<div class="text-sm">
				<p class="font-semibold">Gagal Membuat proyek</p>
				<p class="mt-0.5">{apiErrors.general}</p>
			</div>
		</div>
	{/if}

	<Card class="flex flex-col gap-1 rounded-control">
		<div
			class="flex w-full flex-wrap items-center justify-between gap-x-2 rounded-control border border-border bg-background px-4 py-1"
		>
			<p class="min-w-0 font-mono font-medium wrap-anywhere">
				{repo?.full_name || wizard.gitUrl || 'Repository'}
			</p>
			<Button variant="link" onclick={onRepositoryChange}>Ganti repository</Button>
		</div>

		{#if fieldError('repository', true)}
			<p class="mt-1 px-1 text-sm text-error-dark">{fieldError('repository', true)}</p>
		{/if}

		<div class="flex w-full flex-col gap-2 py-3">
			<FormField
				id="project-name"
				label="Nama proyek"
				bind:value={wizard.projectName}
				error={nameError}
				hint="Default diambil dari nama repository. Bisa diganti kapan saja lewat tab Pengaturan setelah proyek dibuat."
				oninput={() => (nameTouched = true)}
			/>
			<div class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs" aria-live="polite">
				<span>Domain preview:</span>
				<span
					data-testid="domain-preview"
					class="rounded-control border border-border bg-muted/10 px-1.5 py-0.5 font-mono wrap-anywhere text-foreground"
				>
					{previewText}
				</span>
			</div>
			{#if previewQuery.data && previewIsCurrent}
				<p class="text-xs text-foreground/70">
					Domain belum dipesan, jadi bisa berbeda kalau keburu dipakai proyek lain.
				</p>
			{/if}
		</div>

		<div class="flex w-full flex-col gap-2 py-3">
			<label for="project-branch" class="font-medium">Branch</label>
			{#key branchSource}
				<BranchCombobox
					id="project-branch"
					value={wizard.selectedBranch}
					branches={branchOptions}
					loading={branchesQuery.isPending}
					allowOther={branchesCutOff}
					invalid={Boolean(fieldError('branch'))}
					describedBy={fieldError('branch') ? 'project-branch-error' : undefined}
					onValueChange={(branch) => (wizard.selectedBranch = branch)}
				/>
			{/key}
			{#if fieldError('branch')}
				<p id="project-branch-error" class="text-sm text-error-dark">{fieldError('branch')}</p>
			{/if}
			{#if branchesErrorMessage}
				<div class="flex flex-wrap items-center gap-2 text-sm" role="alert">
					<p class="min-w-0 flex-1 basis-60">{branchesErrorMessage}</p>
					{#if branchesInactive}
						<Button variant="secondary" externalHref={reconnectUrl ?? undefined} sameTab>
							Hubungkan ulang GitHub
						</Button>
					{:else}
						<Button variant="secondary" onclick={() => branchesQuery.refetch()}>Coba lagi</Button>
					{/if}
				</div>
			{:else if branchesCutOff}
				<p class="text-xs text-foreground/70">
					Daftar ini berisi {INSTALLATION_BRANCH_LIMIT} branch pertama. Kalau branch-mu tidak ada, ketik
					namanya lengkap.
				</p>
			{/if}
		</div>

		<div class="py-3">
			<FormField
				id="project-port"
				label="Port (opsional)"
				bind:value={wizard.configuredPort}
				inputmode="numeric"
				placeholder="3000"
				error={fieldError('configured_port')}
				hint="Sakala mengisi environment variable PORT dengan angka ini, dan aplikasimu harus mendengarkan di PORT. Kosong berarti 3000."
			/>
		</div>
		<div class="py-3">
			<FormField
				id="project-build-command"
				label="Build command (opsional)"
				bind:value={wizard.buildCommand}
				placeholder="npm run build"
				spellcheck={false}
				error={fieldError('build_command')}
				hint={BUILD_COMMAND_HELP}
				inputClass="font-mono"
			/>
		</div>
		<div class="py-3">
			<FormField
				id="project-start-command"
				label="Start command (opsional)"
				bind:value={wizard.startCommand}
				placeholder="npm start"
				spellcheck={false}
				error={fieldError('start_command')}
				hint={START_COMMAND_HELP}
				inputClass="font-mono"
			/>
		</div>
		<div class="py-3">
			<FormField
				id="project-root-directory"
				label="Root directory (opsional)"
				bind:value={wizard.rootDirectory}
				placeholder="apps/web"
				spellcheck={false}
				error={fieldError('root_directory')}
				hint={ROOT_DIRECTORY_HELP}
				inputClass="font-mono"
			/>
		</div>

		<WizardEnvEditor bind:this={envEditor} />

		{#if isGithub}
			<ToggleField
				title="Auto-deploy"
				description={AUTO_DEPLOY_HELP}
				checked={wizard.autoDeploy}
				onToggle={() => (wizard.autoDeploy = !wizard.autoDeploy)}
			/>
		{:else}
			<p class="py-3 text-sm text-foreground/70">{AUTO_DEPLOY_UNAVAILABLE_HELP}</p>
		{/if}
	</Card>

	{#if pilotLimits}
		<p class="text-sm text-foreground/70">{formatPilotRuntime(pilotLimits)}</p>
	{/if}

	<Button size="lg" class="w-full" type="submit" disabled={isSubmitting || atQuota}>
		{#if isSubmitting}
			<CircleNotchIcon class="size-5 animate-spin" aria-hidden="true" />
			<span>Membuat proyek...</span>
		{:else}
			<span>Buat proyek</span>
		{/if}
	</Button>
</form>
