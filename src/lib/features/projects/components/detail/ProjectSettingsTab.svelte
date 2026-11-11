<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import ToggleField from '$lib/components/ui/ToggleField.svelte';
	import {
		AUTO_DEPLOY_HELP,
		AUTO_DEPLOY_UNAVAILABLE_HELP,
		BUILD_COMMAND_HELP,
		ROOT_DIRECTORY_HELP,
		START_COMMAND_HELP
	} from '../../build-help';
	import { createRepositoryBranchesQuery, type BranchSource } from '../../githubQueries';
	import { createPilotLimitsQuery, createProjectQuery } from '../../queries';
	import {
		createDeleteProjectMutation,
		createRequestInspectionMutation,
		createUpdateProjectMutation
	} from '../../mutations';
	import {
		createProjectDetailState,
		getProjectDetailContext,
		projectConfigDraftFrom,
		type ProjectConfigDraft
	} from '../../detail/projectDetailState.svelte';
	import { buildConfigurationSchema } from '../../validation/createProjectSchema';
	import BranchCombobox from '../create/BranchCombobox.svelte';
	import DeleteProjectConfirmModal from './DeleteProjectConfirmModal.svelte';

	let { projectId }: { projectId: string } = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const pilotLimits = createPilotLimitsQuery();
	const deleteMutation = createDeleteProjectMutation();
	const updateMutation = createUpdateProjectMutation();
	const inspectMutation = createRequestInspectionMutation();

	// The draft lives in the project layout, so it outlasts this component across tab switches.
	const draft = getProjectDetailContext() ?? createProjectDetailState();

	const originalName = $derived(projectQuery.data?.name ?? projectQuery.data?.project_name ?? '');
	const originalBranch = $derived(projectQuery.data?.branch ?? '');

	const name = $derived(draft.draftName ?? originalName);
	const branch = $derived(draft.draftBranch ?? originalBranch);

	const originalConfig = $derived(
		projectQuery.data ? projectConfigDraftFrom(projectQuery.data) : null
	);
	const config = $derived(draft.draftConfig ?? originalConfig);
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

	type ConfigErrors = Partial<Record<keyof ProjectConfigDraft, string>>;
	let configErrors = $state<ConfigErrors>({});

	let nameError = $state('');
	let branchError = $state('');
	let formError = $state('');
	let saveMessage = $state('');

	let isDeleteDialogOpen = $state(false);
	let deleteError = $state('');

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
		if (!config || !originalConfig) return;
		draft.setConfigDraft({ ...config, ...patch }, originalConfig);
		for (const field of Object.keys(patch) as (keyof ProjectConfigDraft)[]) {
			configErrors[field] = undefined;
		}
		formError = '';
		saveMessage = '';
	}

	function validateConfig(): boolean {
		if (!config) return true;
		const result = buildConfigurationSchema.safeParse(config);
		if (result.success) {
			configErrors = {};
			return true;
		}
		const fields = result.error.flatten().fieldErrors;
		configErrors = {
			configured_port: fields.configured_port?.[0],
			build_command: fields.build_command?.[0],
			start_command: fields.start_command?.[0],
			root_directory: fields.root_directory?.[0]
		};
		return false;
	}

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let saving = false;
	let deleting = false;

	function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (!draft.isDirty || saving) return;

		const trimmedName = name.trim();
		const trimmedBranch = branch.trim();

		nameError = trimmedName ? '' : 'Isi nama proyek. Nama ini tampil di daftar proyek.';
		branchError = trimmedBranch ? '' : 'Isi nama branch yang akan dideploy, misalnya main.';
		formError = '';
		const configValid = validateConfig();
		if (nameError || branchError || !configValid) return;

		const configPayload = draft.configPayload();
		const rootDirectoryChanged = 'root_directory' in configPayload;
		const buildChanged = Object.keys(configPayload).some((field) => field !== 'auto_deploy');

		saving = true;
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
							root_directory: error.errors.root_directory?.[0]
						};
						if (nameError || branchError || Object.values(configErrors).some(Boolean)) return;
					}
					formError = getErrorMessage(error, 'Perubahan belum tersimpan. Silakan coba lagi.');
				},
				onSettled: () => {
					saving = false;
				}
			}
		);
	}

	function handleOpenDelete() {
		deleteError = '';
		isDeleteDialogOpen = true;
	}

	function handleCloseDelete() {
		deleteError = '';
		isDeleteDialogOpen = false;
	}

	function handleConfirmDelete() {
		if (deleting) return;
		deleting = true;
		deleteError = '';
		deleteMutation.mutate(projectId, {
			onSuccess: () => {
				isDeleteDialogOpen = false;
				toast.success(`Proyek ${projectQuery.data?.name ?? ''} dihapus.`.replace('  ', ' '));
				goto(resolveRoute('/(app)/projects'));
			},
			onError: (error) => {
				deleteError = getErrorMessage(error, 'Proyek belum bisa dihapus. Silakan coba lagi.');
			},
			onSettled: () => {
				deleting = false;
			}
		});
	}
</script>

{#snippet configField(
	id: string,
	label: string,
	field: Exclude<keyof ProjectConfigDraft, 'auto_deploy'>,
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

<div class="flex w-full max-w-reading flex-col gap-4">
	{#if projectQuery.isLoading}
		<div class="p-6 text-center text-sm text-muted">Memuat pengaturan...</div>
	{:else if projectQuery.isError}
		<div class="p-6 text-center text-sm text-error">Gagal memuat data pengaturan proyek.</div>
	{:else if projectQuery.data}
		<form onsubmit={handleSave} novalidate class="surface-card flex flex-col gap-5 p-4 sm:p-6">
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

			<FormField
				id="subdomain"
				label="Subdomain, dibuat otomatis"
				value={projectQuery.data.slug ?? ''}
				disabled
				inputClass="font-mono"
			/>

			{@render configField(
				'rootDirectory',
				'Root directory',
				'root_directory',
				'apps/web',
				ROOT_DIRECTORY_HELP,
				{ mono: true }
			)}
			{@render configField(
				'port',
				'Port',
				'configured_port',
				String(projectQuery.data.effective_port),
				`Sekarang ${projectQuery.data.effective_port}. Aplikasimu harus mendengarkan di environment variable PORT.`,
				{ numeric: true }
			)}
			{@render configField(
				'buildCommand',
				'Build command',
				'build_command',
				'npm run build',
				BUILD_COMMAND_HELP,
				{ mono: true }
			)}
			{@render configField(
				'startCommand',
				'Start command',
				'start_command',
				'npm start',
				START_COMMAND_HELP,
				{ mono: true }
			)}

			<div class="border-t border-border">
				<ToggleField
					title="Auto-deploy"
					description={isGithubInstallation ? AUTO_DEPLOY_HELP : AUTO_DEPLOY_UNAVAILABLE_HELP}
					checked={isGithubInstallation && (config?.auto_deploy ?? false)}
					disabled={!isGithubInstallation}
					onToggle={() => updateConfig({ auto_deploy: !config?.auto_deploy })}
				/>
			</div>

			<p class="text-xs text-foreground/70">
				Branch, port, command, dan root directory baru dipakai mulai deployment berikutnya.
				<strong class="text-foreground">Redeploy</strong> di atas juga menyimpan perubahan yang belum
				tersimpan.
			</p>

			<div class="flex flex-wrap items-center justify-end gap-3">
				{#if formError}
					<p role="alert" class="mr-auto text-sm text-error-dark">{formError}</p>
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
		</form>

		<section
			aria-labelledby="danger-zone-title"
			class="flex w-full flex-col justify-between gap-4 rounded-card border border-error/40 bg-surface p-4 sm:flex-row sm:items-center sm:p-6"
		>
			<div class="min-w-0">
				<h2 id="danger-zone-title" class="font-sans text-base font-semibold text-foreground">
					Zona bahaya
				</h2>
				<p class="mt-1 text-sm text-foreground">
					Menghapus proyek menghentikan aplikasinya dan tidak bisa dibatalkan.
				</p>
			</div>

			<Button variant="danger" onclick={handleOpenDelete} disabled={deleteMutation.isPending}>
				<Trash size={16} aria-hidden="true" />
				Hapus proyek
			</Button>
		</section>

		<DeleteProjectConfirmModal
			open={isDeleteDialogOpen}
			projectName={projectQuery.data.name ?? projectQuery.data.project_name ?? ''}
			defaultDomain={projectQuery.data.default_domain ?? undefined}
			retentionDays={pilotLimits.data?.deleted_project_retention_days}
			isLoading={deleteMutation.isPending}
			error={deleteError}
			onConfirm={handleConfirmDelete}
			onClose={handleCloseDelete}
		/>
	{/if}
</div>
