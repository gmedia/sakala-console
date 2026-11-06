<script lang="ts">
	import Key from 'phosphor-svelte/lib/Key';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { tick } from 'svelte';
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import Check from 'phosphor-svelte/lib/Check';
	import X from 'phosphor-svelte/lib/X';
	import Plus from 'phosphor-svelte/lib/Plus';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { ApiError, getErrorMessage } from '$lib/api/errors';
	import { createEnvironmentVariablesQuery, createProjectQuery } from '../../queries';
	import {
		createAddEnvironmentVariableMutation,
		createDeleteEnvironmentVariableMutation,
		createUpdateEnvironmentVariableMutation
	} from '../../mutations';
	import { useProjectRedeploy } from '../../detail/use-project-redeploy.svelte';
	import type { EnvironmentVariable } from '../../type';
	import { getEnvironmentVariableValue } from '../../api';
	import { ENV_KEY_REGEX, normalizeEnvKey } from '../../validation/environmentVariable';
	import DeleteEnvConfirmModal from './DeleteEnvConfirmModal.svelte';
	import EnvKey from './EnvKey.svelte';

	let { projectId }: { projectId: string } = $props();

	// Queries & Mutations
	const query = createEnvironmentVariablesQuery(() => projectId);
	const addMutation = createAddEnvironmentVariableMutation();
	const deleteMutation = createDeleteEnvironmentVariableMutation();
	const updateMutation = createUpdateEnvironmentVariableMutation();
	const projectQuery = createProjectQuery(() => projectId);
	const redeploy = useProjectRedeploy(() => ({
		id: projectId,
		branch: projectQuery.data?.branch ?? ''
	}));

	// Local State
	let revealedValues = $state<Record<number, string>>({});
	const visibleIds = new SvelteSet<number>();
	const loadingRevealIds = new SvelteSet<number>();
	const revealErrors = new SvelteMap<number, string>();

	let isAdding = $state(false);
	let newKey = $state('');
	let newValue = $state('');
	// Secret unless the user says otherwise, the same default as the API.
	let newIsSecret = $state(true);
	let keyError = $state('');
	let valueError = $state('');
	let formError = $state('');

	let deletingEnv = $state<{ id: number; key: string } | null>(null);
	let deleteError = $state('');

	let editingEnv = $state<EnvironmentVariable | null>(null);
	let editValue = $state('');
	let editIsSecret = $state(true);
	let editValueError = $state('');
	let editFormError = $state('');
	let editValueInput = $state<HTMLInputElement>();

	let keyInput = $state<HTMLInputElement>();
	let valueInput = $state<HTMLInputElement>();
	let addButton = $state<HTMLButtonElement>();

	function clearFormErrors() {
		keyError = '';
		valueError = '';
		formError = '';
	}

	// Handlers
	async function toggleReveal(id: number) {
		revealErrors.delete(id);

		if (visibleIds.has(id)) {
			visibleIds.delete(id);
			return;
		}

		if (revealedValues[id] !== undefined) {
			visibleIds.add(id);
			return;
		}

		try {
			loadingRevealIds.add(id);
			const res = await getEnvironmentVariableValue(projectId, id);
			revealedValues[id] = res.data.value;
			visibleIds.add(id);
		} catch (error) {
			revealErrors.set(
				id,
				getErrorMessage(error, 'Nilai variabel belum bisa diambil. Silakan coba lagi.')
			);
		} finally {
			loadingRevealIds.delete(id);
		}
	}

	function handleKeyInput(e: Event) {
		const target = e.target as HTMLInputElement;
		newKey = normalizeEnvKey(target.value);
		keyError = '';
		formError = '';
	}

	function handleValueInput() {
		valueError = '';
		formError = '';
	}

	async function handleOpenAdd() {
		isAdding = true;
		clearFormErrors();
		await tick();
		keyInput?.focus();
	}

	async function handleCancelAdd() {
		newKey = '';
		newValue = '';
		newIsSecret = true;
		clearFormErrors();
		isAdding = false;
		await tick();
		addButton?.focus();
	}

	function validateForm(key: string, value: string): boolean {
		clearFormErrors();

		if (!key) {
			keyError = 'Isi nama variabel, misalnya DATABASE_URL.';
		} else if (!ENV_KEY_REGEX.test(key)) {
			keyError = 'Nama variabel harus diawali huruf atau underscore, misalnya APP_ENV.';
		} else if (query.data?.some((env) => env.key === key)) {
			keyError = `Variabel ${key} sudah ada. Pakai tombol Ubah di barisnya untuk mengganti nilainya.`;
		}

		if (!value) valueError = 'Isi nilai variabel. Aplikasi membacanya saat redeploy berikutnya.';

		return !keyError && !valueError;
	}

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let saving = false;
	let deleting = false;

	function handleSave(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;

		const trimmedKey = newKey.trim();
		const trimmedVal = newValue.trim();

		if (!validateForm(trimmedKey, trimmedVal)) {
			if (keyError) keyInput?.focus();
			else valueInput?.focus();
			return;
		}

		saving = true;
		addMutation.mutate(
			{
				projectId,
				data: {
					key: trimmedKey,
					value: trimmedVal,
					is_secret: newIsSecret
				}
			},
			{
				onSuccess: () => {
					void handleCancelAdd();
				},
				onError: (err) => {
					if (err instanceof ApiError && err.isValidationError) {
						keyError = err.errors.key?.[0] ?? '';
						valueError = err.errors.value?.[0] ?? '';
						if (keyError || valueError) return;
					}
					formError = getErrorMessage(err, 'Variabel belum bisa disimpan. Silakan coba lagi.');
				},
				onSettled: () => {
					saving = false;
				}
			}
		);
	}

	function handleFormKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !addMutation.isPending) {
			event.preventDefault();
			void handleCancelAdd();
		}
	}

	async function handleOpenEdit(env: EnvironmentVariable) {
		editingEnv = env;
		editValue = env.value ?? '';
		editIsSecret = env.is_secret;
		editValueError = '';
		editFormError = '';
		await tick();
		editValueInput?.focus();
	}

	async function handleCancelEdit() {
		const id = editingEnv?.id;
		editingEnv = null;
		await tick();
		if (id !== undefined) document.getElementById(`env-edit-button-${id}`)?.focus();
	}

	// `isPending` updates a tick after mutate(), which is too late for a double click.
	let updating = false;

	function handleSaveEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editingEnv || updating) return;

		const env = editingEnv;
		const value = editValue.trim();
		// A secret's value is never sent to the browser, so empty here means "keep the current one".
		const keepsValue = env.is_secret && !value;

		if (!value && !keepsValue) {
			editValueError = 'Isi nilai variabel. Aplikasi membacanya saat redeploy berikutnya.';
			editValueInput?.focus();
			return;
		}
		if (keepsValue && editIsSecret === env.is_secret) {
			void handleCancelEdit();
			return;
		}

		updating = true;
		editValueError = '';
		editFormError = '';
		updateMutation.mutate(
			{
				projectId,
				id: env.id,
				data: { ...(keepsValue ? {} : { value }), is_secret: editIsSecret }
			},
			{
				onSuccess: () => {
					// What was revealed before may no longer be the current value.
					delete revealedValues[env.id];
					visibleIds.delete(env.id);
					void handleCancelEdit();
				},
				onError: (err) => {
					if (err instanceof ApiError && err.isValidationError) {
						editValueError = err.errors.value?.[0] ?? '';
						if (editValueError) return;
					}
					editFormError = getErrorMessage(err, 'Perubahan belum bisa disimpan. Silakan coba lagi.');
				},
				onSettled: () => {
					updating = false;
				}
			}
		);
	}

	function handleEditKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !updateMutation.isPending) {
			event.preventDefault();
			void handleCancelEdit();
		}
	}

	function handlePromptDelete(env: { id: number; key: string }) {
		deleteError = '';
		deletingEnv = env;
	}

	function handleCloseDelete() {
		deleteError = '';
		deletingEnv = null;
	}

	function handleConfirmDelete() {
		if (!deletingEnv || deleting) return;
		const envId = deletingEnv.id;
		deleting = true;
		deleteError = '';

		deleteMutation.mutate(
			{ projectId, id: envId },
			{
				onSuccess: () => {
					visibleIds.delete(envId);
					loadingRevealIds.delete(envId);
					revealErrors.delete(envId);
					delete revealedValues[envId];
					deletingEnv = null;
				},
				onError: (err) => {
					deleteError = getErrorMessage(err, 'Variabel belum bisa dihapus. Silakan coba lagi.');
				},
				onSettled: () => {
					deleting = false;
				}
			}
		);
	}

	const inputClass = 'control-input min-w-0';
</script>

<div class="flex w-full max-w-280 flex-col">
	{#if projectQuery.data?.redeploy_required}
		<div
			role="status"
			class="mb-4 flex flex-col justify-between gap-3 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 md:flex-row md:items-center"
		>
			<p class="min-w-0 text-sm text-foreground">
				Perubahan variabel belum dipakai aplikasi yang sedang berjalan. Redeploy supaya perubahannya
				berlaku.
			</p>
			<Button onclick={redeploy.trigger} disabled={redeploy.isProcessing}>
				{redeploy.isProcessing ? 'Menjalankan...' : 'Redeploy sekarang'}
			</Button>
		</div>
		{#if redeploy.errorMessage}
			<p role="alert" class="mb-4 text-sm text-error-dark">
				{redeploy.errorMessage}
			</p>
		{/if}
	{/if}

	<div class="@container w-full rounded-control border border-border bg-surface">
		{#if query.isLoading}
			<div class="p-6 text-center text-sm text-muted">Memuat environment variables...</div>
		{:else if query.isError}
			<div class="p-6 text-center text-sm text-error">Gagal memuat data environment variables.</div>
		{:else if query.data}
			{#if query.data.length === 0 && !isAdding}
				<EmptyState
					icon={Key}
					title="Belum ada variabel"
					description="Belum ada environment variable untuk proyek ini."
					class="border-none py-8 sm:py-8"
				/>
			{:else}
				<ul class="flex w-full flex-col divide-y divide-border">
					{#each query.data as env (env.id)}
						<li
							class="grid min-h-18 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 p-4 @2xl:grid-cols-[14.5rem_minmax(0,1fr)_auto_auto] @2xl:gap-x-4 @2xl:px-6 @2xl:py-2"
						>
							<span class="flex min-w-0 flex-col">
								<span class="min-w-0 font-mono font-semibold text-sm text-foreground">
									<EnvKey name={env.key} />
								</span>
								{#if env.is_secret}
									<span class="text-xs text-foreground/70">Secret</span>
								{/if}
							</span>

							<span
								class="col-span-3 row-start-2 flex h-7 min-w-0 items-center @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1 @2xl:h-10"
							>
								{#if !env.is_secret}
									<span class="truncate font-mono text-sm text-foreground/70 select-all">
										{env.value ?? ''}
									</span>
								{:else if visibleIds.has(env.id)}
									<span class="truncate font-mono text-sm text-foreground/70 select-all">
										{revealedValues[env.id] ?? ''}
									</span>
								{:else}
									<span
										class="truncate font-mono text-sm text-muted select-none"
										aria-label="Nilai disembunyikan"
										role="img"
									>
										••••••••••••
									</span>
								{/if}
							</span>

							<span class="flex shrink-0 items-center gap-1 @2xl:col-start-3">
								{#if env.is_secret}
									<Button
										variant="ghost"
										size="icon"
										onclick={() => toggleReveal(env.id)}
										disabled={loadingRevealIds.has(env.id)}
										aria-pressed={visibleIds.has(env.id)}
										aria-label={`${visibleIds.has(env.id) ? 'Sembunyikan' : 'Tampilkan'} nilai ${env.key}`}
										title={visibleIds.has(env.id) ? 'Sembunyikan nilai' : 'Tampilkan nilai'}
									>
										{#if loadingRevealIds.has(env.id)}
											<CircleNotch size={20} weight="bold" class="animate-spin text-primary" />
										{:else if visibleIds.has(env.id)}
											<EyeSlash size={24} weight="regular" />
										{:else}
											<Eye size={24} weight="regular" />
										{/if}
									</Button>
								{/if}

								<Button
									variant="ghost"
									size="sm"
									id={`env-edit-button-${env.id}`}
									onclick={() => handleOpenEdit(env)}
									aria-label={`Ubah ${env.key}`}
								>
									Ubah
								</Button>
							</span>

							<Button
								variant="ghost"
								size="sm"
								class="text-error-dark hover:text-error-dark"
								onclick={() => handlePromptDelete(env)}
								disabled={deleteMutation.isPending}
								aria-label={`Hapus ${env.key}`}
							>
								Hapus
							</Button>

							{#if revealErrors.has(env.id)}
								<p role="alert" class="col-span-full text-xs text-error-dark">
									{revealErrors.get(env.id)}
								</p>
							{/if}

							{#if editingEnv?.id === env.id}
								<!-- Esc is a shortcut; the Batal button stays the accessible path. -->
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<form
									onsubmit={handleSaveEdit}
									onkeydown={handleEditKeydown}
									novalidate
									aria-label={`Ubah ${env.key}`}
									class="col-span-full mt-2 rounded-control bg-primary-50/50 p-3"
								>
									<label for="env-edit-value" class="font-medium text-xs text-foreground">
										Nilai baru
									</label>
									<input
										bind:this={editValueInput}
										bind:value={editValue}
										oninput={() => (editValueError = '')}
										id="env-edit-value"
										type="text"
										placeholder={env.is_secret
											? 'Kosongkan untuk mempertahankan nilai'
											: 'Isi nilai'}
										autocomplete="off"
										spellcheck="false"
										aria-invalid={editValueError ? 'true' : undefined}
										aria-describedby={editValueError ? 'env-edit-value-error' : undefined}
										class="{inputClass} mt-1 {editValueError
											? 'border-error-dark focus:border-error-dark'
											: 'border-border-strong focus:border-primary'}"
									/>
									{#if editValueError}
										<p id="env-edit-value-error" class="mt-1 text-xs text-error-dark">
											{editValueError}
										</p>
									{/if}

									<label class="mt-3 flex min-h-6 items-center gap-2 text-sm">
										<input type="checkbox" bind:checked={editIsSecret} class="size-4" />
										Simpan sebagai secret, nilainya hanya terlihat lewat tombol tampilkan
									</label>

									{#if editFormError}
										<p role="alert" class="mt-2 text-xs text-error-dark">
											{editFormError}
										</p>
									{/if}

									<div class="mt-3 flex justify-end gap-2">
										<Button variant="ghost" onclick={handleCancelEdit}>Batal</Button>
										<Button type="submit" disabled={updateMutation.isPending}>
											{updateMutation.isPending ? 'Menyimpan...' : 'Simpan perubahan'}
										</Button>
									</div>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}

		{#if isAdding}
			<!-- Esc is a shortcut; the Batal button stays the accessible path. -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<form
				onsubmit={handleSave}
				onkeydown={handleFormKeydown}
				novalidate
				aria-label="Tambah variabel"
				class="w-full rounded-b-control border-t border-border bg-primary-50/50 p-4 @2xl:px-6"
			>
				<div class="flex flex-col gap-3 @2xl:flex-row @2xl:items-start">
					<div class="flex min-w-0 flex-col gap-1 @2xl:w-58 @2xl:shrink-0">
						<label for="env-new-key" class="font-medium text-xs text-foreground">
							Nama variabel
						</label>
						<input
							bind:this={keyInput}
							id="env-new-key"
							type="text"
							placeholder="NAMA_VARIABEL"
							value={newKey}
							oninput={handleKeyInput}
							autocomplete="off"
							spellcheck="false"
							aria-invalid={keyError ? 'true' : undefined}
							aria-describedby={keyError ? 'env-new-key-error' : undefined}
							class="{inputClass} uppercase placeholder:normal-case {keyError
								? 'border-error-dark focus:border-error-dark'
								: 'border-border-strong focus:border-primary'}"
						/>
						{#if keyError}
							<p id="env-new-key-error" class="text-xs text-error-dark">
								{keyError}
							</p>
						{/if}
					</div>

					<div class="flex min-w-0 flex-1 flex-col gap-1">
						<label for="env-new-value" class="font-medium text-xs text-foreground"> Nilai </label>
						<input
							bind:this={valueInput}
							id="env-new-value"
							type="text"
							placeholder="Isi nilai"
							bind:value={newValue}
							oninput={handleValueInput}
							autocomplete="off"
							spellcheck="false"
							aria-invalid={valueError ? 'true' : undefined}
							aria-describedby={valueError ? 'env-new-value-error' : undefined}
							class="{inputClass} {valueError
								? 'border-error-dark focus:border-error-dark'
								: 'border-border-strong focus:border-primary'}"
						/>
						{#if valueError}
							<p id="env-new-value-error" class="text-xs text-error-dark">
								{valueError}
							</p>
						{/if}
					</div>

					<div class="flex shrink-0 items-center justify-end gap-2 @2xl:pt-6.5">
						<Button
							size="icon"
							type="submit"
							disabled={addMutation.isPending}
							aria-label="Simpan"
							title="Simpan"
						>
							{#if addMutation.isPending}
								<CircleNotch size={20} weight="bold" class="animate-spin" />
							{:else}
								<Check size={24} weight="bold" />
							{/if}
						</Button>

						<Button
							variant="ghost"
							size="icon"
							onclick={handleCancelAdd}
							aria-label="Batal"
							title="Batal"
						>
							<X size={24} weight="regular" />
						</Button>
					</div>
				</div>

				<label class="mt-3 flex min-h-6 items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={newIsSecret} class="size-4" />
					Simpan sebagai secret, nilainya hanya terlihat lewat tombol tampilkan
				</label>

				{#if formError}
					<p role="alert" class="mt-2 text-xs text-error-dark">{formError}</p>
				{/if}
			</form>
		{/if}
	</div>

	{#if isAdding}
		<p class="mt-3 text-xs text-foreground/70">
			Nama variabel otomatis jadi UPPERCASE_SNAKE_CASE. Tekan Enter atau centang untuk simpan, Esc
			atau silang untuk batal.
		</p>
	{/if}

	{#if !isAdding}
		<Button
			variant="secondary"
			size="lg"
			class="mt-4 w-full"
			bind:ref={addButton}
			onclick={handleOpenAdd}
		>
			<Plus size={24} weight="regular" />
			<span>Tambah variabel</span>
		</Button>
	{/if}

	<DeleteEnvConfirmModal
		open={deletingEnv !== null}
		envKey={deletingEnv?.key ?? ''}
		isLoading={deleteMutation.isPending}
		error={deleteError}
		onConfirm={handleConfirmDelete}
		onClose={handleCloseDelete}
	/>
</div>
