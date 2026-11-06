<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolveRoute } from '$app/paths';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import Button from '$lib/components/ui/Button.svelte';
	import ToggleField from '$lib/components/ui/ToggleField.svelte';
	import {
		AUTO_DEPLOY_HELP,
		AUTO_DEPLOY_UNAVAILABLE_HELP,
		BUILD_COMMAND_HELP,
		ROOT_DIRECTORY_HELP,
		START_COMMAND_HELP
	} from '../../build-help';
	import { createProjectQuery } from '../../queries';
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
	import DeleteProjectConfirmModal from './DeleteProjectConfirmModal.svelte';

	let { projectId }: { projectId: string } = $props();

	const projectQuery = createProjectQuery(() => projectId);
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

	function handleNameInput(event: Event) {
		nameError = '';
		formError = '';
		updateDraft((event.currentTarget as HTMLInputElement).value, branch);
	}

	function handleBranchInput(event: Event) {
		branchError = '';
		formError = '';
		updateDraft(name, (event.currentTarget as HTMLInputElement).value);
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

	const editableInputClass =
		'h-9 w-full min-w-0 rounded-lg border bg-background px-3 font-montserrat text-sm outline-none transition-colors';
	const readonlyInputClass =
		'h-9 w-full min-w-0 cursor-not-allowed rounded-lg border border-border bg-surface-elevated/50 px-3 font-montserrat text-sm text-foreground/70 outline-none';
</script>

{#snippet configField(
	id: string,
	label: string,
	field: Exclude<keyof ProjectConfigDraft, 'auto_deploy'>,
	placeholder: string,
	help: string,
	inputmode: 'text' | 'numeric' = 'text'
)}
	<div class="flex min-w-0 flex-col">
		<label for={id} class="mb-2 font-montserrat-medium text-xs text-foreground">{label}</label>
		<input
			type="text"
			{id}
			{inputmode}
			{placeholder}
			value={config?.[field] ?? ''}
			oninput={(event) => updateConfig({ [field]: event.currentTarget.value })}
			spellcheck="false"
			aria-invalid={configErrors[field] ? 'true' : undefined}
			aria-describedby="{id}-help"
			class="{editableInputClass} {configErrors[field]
				? 'border-error-dark focus:border-error-dark'
				: 'border-border-strong focus:border-primary'}"
		/>
		<p
			id="{id}-help"
			class="mt-1 font-montserrat text-xs {configErrors[field]
				? 'text-error-dark'
				: 'text-foreground/70'}"
		>
			{configErrors[field] ?? help}
		</p>
	</div>
{/snippet}

<div class="flex w-full max-w-280 flex-col">
	{#if projectQuery.isLoading}
		<div class="p-6 text-center font-montserrat text-sm text-muted">Memuat pengaturan...</div>
	{:else if projectQuery.isError}
		<div class="p-6 text-center font-montserrat text-sm text-error">
			Gagal memuat data pengaturan proyek.
		</div>
	{:else if projectQuery.data}
		<form
			onsubmit={handleSave}
			novalidate
			class="@container w-full rounded-lg border border-border bg-surface p-4 shadow-none sm:p-6"
		>
			<div class="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @2xl:gap-6">
				<div class="flex min-w-0 flex-col gap-4">
					<div class="flex min-w-0 flex-col">
						<label for="projectName" class="mb-2 font-montserrat-medium text-xs text-foreground">
							Nama Proyek
						</label>
						<input
							type="text"
							id="projectName"
							value={name}
							oninput={handleNameInput}
							placeholder="Nama Proyek"
							required
							aria-invalid={nameError ? 'true' : undefined}
							aria-describedby={nameError ? 'projectName-error' : undefined}
							class="{editableInputClass} {nameError
								? 'border-error-dark focus:border-error-dark'
								: 'border-border-strong focus:border-primary'}"
						/>
						{#if nameError}
							<p id="projectName-error" class="mt-1 font-montserrat text-xs text-error-dark">
								{nameError}
							</p>
						{/if}
					</div>

					<div class="flex min-w-0 flex-col">
						<label for="branch" class="mb-2 font-montserrat-medium text-xs text-foreground">
							Branch
						</label>
						<input
							type="text"
							id="branch"
							value={branch}
							oninput={handleBranchInput}
							placeholder="main"
							required
							aria-invalid={branchError ? 'true' : undefined}
							aria-describedby={branchError ? 'branch-error' : undefined}
							class="{editableInputClass} {branchError
								? 'border-error-dark focus:border-error-dark'
								: 'border-border-strong focus:border-primary'}"
						/>
						{#if branchError}
							<p id="branch-error" class="mt-1 font-montserrat text-xs text-error-dark">
								{branchError}
							</p>
						{/if}
					</div>

					{@render configField(
						'rootDirectory',
						'Root Directory',
						'root_directory',
						'apps/web',
						ROOT_DIRECTORY_HELP
					)}
				</div>

				<div class="flex min-w-0 flex-col gap-4">
					<div class="flex min-w-0 flex-col">
						<div class="mb-2 flex items-center gap-1.5">
							<label for="subdomain" class="font-montserrat-medium text-xs text-foreground">
								Subdomain (URL Publik)
							</label>
							<span class="font-montserrat text-[10px] text-foreground/70">(Otomatis)</span>
						</div>
						<input
							type="text"
							id="subdomain"
							value={projectQuery.data.slug ?? ''}
							disabled
							placeholder="subdomain"
							class={readonlyInputClass}
						/>
					</div>

					{@render configField(
						'port',
						'Port',
						'configured_port',
						String(projectQuery.data.effective_port),
						`Sekarang ${projectQuery.data.effective_port}. Sakala mengisi environment variable PORT dengan angka ini, dan aplikasimu harus mendengarkan di PORT. Kosongkan untuk memakai port bawaan.`,
						'numeric'
					)}
					{@render configField(
						'buildCommand',
						'Build command',
						'build_command',
						'npm run build',
						BUILD_COMMAND_HELP
					)}
					{@render configField(
						'startCommand',
						'Start command',
						'start_command',
						'npm start',
						START_COMMAND_HELP
					)}
				</div>
			</div>

			<div class="mt-2 border-t border-border">
				<ToggleField
					title="Auto-deploy"
					description={isGithubInstallation ? AUTO_DEPLOY_HELP : AUTO_DEPLOY_UNAVAILABLE_HELP}
					checked={isGithubInstallation && (config?.auto_deploy ?? false)}
					disabled={!isGithubInstallation}
					onToggle={() => updateConfig({ auto_deploy: !config?.auto_deploy })}
				/>
			</div>

			<div class="mt-4 flex flex-wrap items-center justify-end gap-3">
				{#if formError}
					<p role="alert" class="mr-auto font-montserrat text-sm text-error-dark">{formError}</p>
				{/if}
				<span role="status" class="font-montserrat text-sm text-foreground/70">{saveMessage}</span>
				<Button
					type="submit"
					class="min-h-10 px-4"
					disabled={!draft.isDirty || updateMutation.isPending}
					aria-busy={updateMutation.isPending}
				>
					{#if updateMutation.isPending}
						<CircleNotch size={16} weight="bold" class="animate-spin" />
					{/if}
					Simpan perubahan
				</Button>
			</div>
		</form>

		<p class="mt-2 font-montserrat text-xs text-foreground/70">
			Branch, port, command, dan root directory baru dipakai mulai deployment berikutnya.
			<strong class="text-foreground">Redeploy</strong> di atas juga menyimpan perubahan yang belum tersimpan.
		</p>

		<div
			class="mt-6 flex w-full flex-col justify-between gap-4 rounded-lg border border-error/50 bg-error-50 p-4 shadow-none sm:flex-row sm:items-center sm:p-5"
		>
			<div class="flex min-w-0 flex-col justify-center">
				<h3 class="mb-1.5 font-montserrat-semibold text-base leading-none text-error">
					Hapus Proyek
				</h3>
				<p class="font-montserrat text-sm leading-relaxed text-error sm:text-base">
					Tindakan ini permanen dan tidak bisa dibatalkan.
				</p>
			</div>

			<button
				type="button"
				onclick={handleOpenDelete}
				disabled={deleteMutation.isPending}
				class="flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-error/50 bg-error-50 px-4 text-error transition-colors hover:bg-error/10 disabled:opacity-50 sm:w-auto sm:justify-between"
			>
				<Trash size={20} weight="regular" />
				<span class="font-montserrat-semibold text-sm">Hapus Proyek</span>
			</button>
		</div>

		<DeleteProjectConfirmModal
			open={isDeleteDialogOpen}
			projectName={projectQuery.data.name ?? projectQuery.data.project_name ?? ''}
			defaultDomain={projectQuery.data.default_domain ?? undefined}
			isLoading={deleteMutation.isPending}
			error={deleteError}
			onConfirm={handleConfirmDelete}
			onClose={handleCloseDelete}
		/>
	{/if}
</div>
