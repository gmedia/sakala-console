<script lang="ts">
	import EyeIcon from 'phosphor-svelte/lib/EyeIcon';
	import EyeSlashIcon from 'phosphor-svelte/lib/EyeSlashIcon';
	import PlusIcon from 'phosphor-svelte/lib/PlusIcon';
	import { SvelteSet } from 'svelte/reactivity';
	import Button from '$lib/components/ui/Button.svelte';
	import { cn } from '$lib/utils/cn';
	import { getCreateProjectContext } from '../../create/createProjectContext';
	import {
		normalizeEnvKey,
		validateEnvKeyFormat,
		validateEnvValue
	} from '../../validation/environmentVariable';

	const wizard = getCreateProjectContext();

	let newKey = $state('');
	let newValue = $state('');
	// Secret unless the user says otherwise, the same default as the API.
	let newIsSecret = $state(true);
	let keyError = $state('');
	let valueError = $state('');
	const visibleIds = new SvelteSet<number>();

	function addDraft(): boolean {
		const key = newKey.trim();
		keyError =
			validateEnvKeyFormat(key) ??
			(wizard.envVars.some((env) => env.key === key)
				? `Variabel ${key} sudah ada di daftar. Hapus dulu kalau mau mengganti nilainya.`
				: '');
		valueError = validateEnvValue(newValue) ?? '';
		if (keyError || valueError) return false;

		wizard.addEnvVar(key, newValue, newIsSecret);
		newKey = '';
		newValue = '';
		newIsSecret = true;
		return true;
	}

	/**
	 * A pair typed but not added would silently go missing when the form is submitted, so submit
	 * adds it first. Returns false when the pair cannot be added, which stops the submit.
	 */
	export function flushDraft(): boolean {
		if (!newKey.trim() && !newValue) return true;
		return addDraft();
	}

	function handleEnter(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		addDraft();
	}
</script>

<fieldset class="flex w-full min-w-0 flex-col gap-2 py-3">
	<legend class="font-montserrat-medium">Environment Variables (opsional)</legend>

	{#if wizard.envVars.length > 0}
		<ul class="flex flex-col gap-1">
			{#each wizard.envVars as env (env.id)}
				{@const visible = visibleIds.has(env.id)}
				<li
					class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-muted/20 bg-white px-3 py-2"
				>
					<p class="min-w-0 font-jetbrains-mono-semibold text-sm wrap-anywhere sm:w-1/3">
						{env.key}
					</p>
					<p class="min-w-0 flex-1 basis-32 font-jetbrains-mono-regular text-sm wrap-anywhere">
						{visible ? env.value : '••••••••••••'}
					</p>
					<div class="ml-auto flex items-center gap-1">
						<Button
							type="button"
							variant="ghost"
							class="size-8 border-none p-0"
							aria-label={visible ? `Sembunyikan nilai ${env.key}` : `Tampilkan nilai ${env.key}`}
							onclick={() => (visible ? visibleIds.delete(env.id) : visibleIds.add(env.id))}
						>
							{#if visible}
								<EyeSlashIcon class="size-4" />
							{:else}
								<EyeIcon class="size-4" />
							{/if}
						</Button>
						<Button
							type="button"
							variant="ghost"
							class="border-none px-2 text-error-dark hover:text-error-dark"
							aria-label={`Hapus ${env.key}`}
							onclick={() => wizard.removeEnvVar(env.id)}
						>
							Hapus
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="flex flex-col gap-2 rounded-lg bg-primary-50 p-2">
		<div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
			<div class="min-w-0">
				<label for="wizard-env-key" class="sr-only">Nama variabel</label>
				<input
					id="wizard-env-key"
					value={newKey}
					oninput={(event) => {
						newKey = normalizeEnvKey(event.currentTarget.value);
						keyError = '';
					}}
					onkeydown={handleEnter}
					placeholder="NAMA_VARIABEL"
					autocomplete="off"
					spellcheck="false"
					aria-invalid={keyError ? 'true' : undefined}
					aria-describedby={keyError ? 'wizard-env-key-error' : undefined}
					class={cn(
						'w-full rounded-lg border font-jetbrains-mono-regular text-sm focus:ring-primary',
						keyError ? 'border-error' : 'border-border-strong'
					)}
				/>
				{#if keyError}
					<p id="wizard-env-key-error" class="mt-1 text-xs text-error-dark">{keyError}</p>
				{/if}
			</div>
			<div class="min-w-0">
				<label for="wizard-env-value" class="sr-only">Nilai variabel</label>
				<input
					id="wizard-env-value"
					type={newIsSecret ? 'password' : 'text'}
					bind:value={newValue}
					oninput={() => (valueError = '')}
					onkeydown={handleEnter}
					placeholder="Isi value"
					autocomplete="off"
					aria-invalid={valueError ? 'true' : undefined}
					aria-describedby={valueError ? 'wizard-env-value-error' : undefined}
					class={cn(
						'w-full rounded-lg border font-montserrat text-sm focus:ring-primary',
						valueError ? 'border-error' : 'border-border-strong'
					)}
				/>
				{#if valueError}
					<p id="wizard-env-value-error" class="mt-1 text-xs text-error-dark">{valueError}</p>
				{/if}
			</div>
			<Button
				type="button"
				variant="primary"
				class="min-h-10 px-3"
				aria-label="Tambah variabel"
				onclick={addDraft}
			>
				<PlusIcon class="size-5" />
				<span class="sm:hidden">Tambah variabel</span>
			</Button>
		</div>
		<label class="flex items-center gap-2 font-montserrat text-sm">
			<input type="checkbox" bind:checked={newIsSecret} class="size-4 rounded" />
			Simpan sebagai rahasia, nilainya disembunyikan setelah disimpan
		</label>
	</div>

	<p class="text-sm text-foreground/70">
		Tidak wajib diisi sekarang. Bisa ditambah atau diubah kapan saja lewat tab Environment Variables
		di halaman proyek.
	</p>
</fieldset>
