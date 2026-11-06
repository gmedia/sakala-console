<script lang="ts">
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import Button from '$lib/components/ui/Button.svelte';
	import { getCreateProjectContext } from '../../create/createProjectContext';
	import { normalizeEnvKey, validateEnvKeyFormat } from '../../validation/environmentVariable';

	type Props = {
		retrying: boolean;
		onRetry: () => void;
		onContinue: () => void;
	};

	let { retrying, onRetry, onContinue }: Props = $props();

	const wizard = getCreateProjectContext();

	const total = $derived(wizard.envSavedCount + wizard.envFailures.length);
	const invalid = $derived(
		wizard.envFailures.some(
			(failure) => validateEnvKeyFormat(failure.env.key) !== null || !failure.env.value.trim()
		)
	);
</script>

{#if wizard.envSaveStatus === 'saving'}
	<div class="mt-3 flex flex-col gap-2" role="status">
		<h2 tabindex="-1" data-step-heading class="text-xl outline-none">Proyek sudah dibuat</h2>
		<p class="flex items-center gap-2">
			<CircleNotchIcon class="size-5 animate-spin text-primary" aria-hidden="true" />
			Menyimpan environment variable...
		</p>
	</div>
{:else}
	<div class="mt-3 flex flex-col gap-4">
		<div>
			<h2 tabindex="-1" data-step-heading class="text-xl outline-none">
				Proyek sudah dibuat, tapi {wizard.envFailures.length} variabel belum tersimpan
			</h2>
			<p>
				{wizard.createdProjectName ?? 'Proyek ini'} sudah ada dan tidak perlu dibuat lagi.
				{wizard.envSavedCount} dari {total} variabel sudah tersimpan. Perbaiki yang di bawah kalau perlu,
				lalu simpan ulang. Nilainya hilang kalau halaman ini ditutup.
			</p>
		</div>

		<ul class="flex flex-col gap-3">
			{#each wizard.envFailures as failure (failure.env.id)}
				<li class="flex flex-col gap-2 rounded-control border border-error/30 bg-surface p-3">
					<div class="grid gap-2 sm:grid-cols-2">
						<div class="min-w-0">
							<label for="retry-key-{failure.env.id}" class="text-sm font-medium">
								Nama variabel
							</label>
							<input
								id="retry-key-{failure.env.id}"
								value={failure.env.key}
								oninput={(event) => {
									failure.env.key = normalizeEnvKey(event.currentTarget.value);
									failure.keyError = undefined;
								}}
								disabled={retrying}
								spellcheck="false"
								aria-invalid={failure.keyError ? 'true' : undefined}
								class="control-input font-mono"
							/>
							{#if failure.keyError}
								<p class="mt-1 text-xs text-error-dark">{failure.keyError}</p>
							{/if}
						</div>
						<div class="min-w-0">
							<label for="retry-value-{failure.env.id}" class="text-sm font-medium">
								Nilai variabel
							</label>
							<input
								id="retry-value-{failure.env.id}"
								type={failure.env.isSecret ? 'password' : 'text'}
								bind:value={failure.env.value}
								oninput={() => (failure.valueError = undefined)}
								disabled={retrying}
								autocomplete="off"
								aria-invalid={failure.valueError ? 'true' : undefined}
								class="control-input"
							/>
							{#if failure.valueError}
								<p class="mt-1 text-xs text-error-dark">{failure.valueError}</p>
							{/if}
						</div>
					</div>
					{#if !failure.keyError && !failure.valueError}
						<p class="text-sm text-error-dark" role="alert">{failure.message}</p>
					{/if}
				</li>
			{/each}
		</ul>

		<Button size="lg" class="w-full" disabled={retrying || invalid} onclick={onRetry}>
			{#if retrying}
				<CircleNotchIcon class="size-5 animate-spin" aria-hidden="true" />
				Menyimpan...
			{:else}
				Simpan ulang variabel
			{/if}
		</Button>
		<Button
			variant="ghost"
			size="lg"
			class="w-full text-primary hover:text-primary-dark"
			disabled={retrying}
			onclick={onContinue}
		>
			Lanjut tanpa variabel ini
		</Button>
	</div>
{/if}
