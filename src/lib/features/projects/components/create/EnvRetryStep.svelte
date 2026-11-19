<script lang="ts">
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import Button from '$lib/components/ui/Button.svelte';
	import { getCreateProjectContext } from '../../create/createProjectContext';
	import { validateEnvKeyFormat } from '../../validation/environmentVariable';
	import EnvFailureList from './EnvFailureList.svelte';

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
	import WizardStepFooter from './WizardStepFooter.svelte';
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

		<EnvFailureList failures={wizard.envFailures} disabled={retrying} />

		<WizardStepFooter>
			<Button
				variant="secondary"
				size="lg"
				class="w-full sm:w-auto"
				disabled={retrying}
				onclick={onContinue}
			>
				Lanjut tanpa variabel ini
			</Button>
			<Button size="lg" class="w-full sm:w-auto" disabled={retrying || invalid} onclick={onRetry}>
				{#if retrying}
					<CircleNotchIcon
						class="size-5 animate-spin motion-reduce:animate-none"
						aria-hidden="true"
					/>
					Menyimpan...
				{:else}
					Simpan ulang variabel
				{/if}
			</Button>
		</WizardStepFooter>
	</div>
{/if}
