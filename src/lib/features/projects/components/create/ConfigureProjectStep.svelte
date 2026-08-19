<script lang="ts">
	import { EyeIcon, EyeSlashIcon, CaretDownIcon, PlusIcon } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import type { CreateProjectPayload } from '../../type';
	import {
		validateConfigureProjectStep,
		isConfigureProjectStepValid,
		sanitizePortInput
	} from '../../validation/configurationProjectStep';

	type Props = {
		onSubmit: (payload: CreateProjectPayload) => void;
		onRepositoryChange: () => void;
		isSubmitting?: boolean;
		error?: string | null;
	};

	let { onSubmit, onRepositoryChange, isSubmitting = false, error = null }: Props = $props();

	const wizard = getCreateProjectContext();

	let touched = $state({
		projectName: false,
		branch: false,
		port: false,
		buildCommand: false
	});

	const errors = $derived(
		validateConfigureProjectStep({
			projectName: wizard.projectName,
			branch: wizard.selectedBranch,
			port: wizard.selectedPort,
			buildCommand: wizard.buildCommand
		})
	);

	let newEnv = $state({
		key: '',
		value: ''
	});
	const isNewEnvValid = $derived(newEnv.key.trim() !== '' && newEnv.value.trim() !== '');

	function addEnvVar() {
		wizard.addEnvVar(newEnv.key, newEnv.value);

		newEnv.key = '';
		newEnv.value = '';
	}

	function handlePortInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		wizard.selectedPort = sanitizePortInput(target.value);
	}

	function toggleEnvVisibility(id: number) {
		wizard.toggleEnvVisible(id);
	}

	function removeEnvVar(id: number) {
		wizard.removeEnvVar(id);
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		touched = {
			projectName: true,
			branch: true,
			port: true,
			buildCommand: true
		};
		if (!isConfigureProjectStepValid(errors)) {
			return;
		}
		onSubmit(wizard.createProjectPayload);
	}

	const branchOptions = $derived.by(() => {
		const base: { label: string; value: string }[] = [
			{ label: 'main', value: 'main' },
			{ label: 'develop', value: 'develop' }
		];

		const defaultBranch = wizard.selectedRepository?.default_branch;
		if (defaultBranch && !base.some((opt) => opt.value === defaultBranch)) {
			base.unshift({ label: defaultBranch, value: defaultBranch });
		}

		return base;
	});
</script>

<form class="flex flex-col mt-3 gap-4" onsubmit={handleSubmit}>
	<div>
		<p class="text-lg font-montserrat-semibold">Persiapan deployment</p>
		<p class="font-montserrat">Atur konfigurasi proyek sebelum dibuat.</p>
	</div>

	<Card class="rounded-lg">
		<div
			class="flex justify-between items-center w-full bg-background rounded-lg py-1 px-4 border border-muted/20"
		>
			<p class="font-jetbrains-mono-medium">
				{wizard.selectedRepository?.full_name || 'Repository'}
			</p>
			<Button
				onclick={onRepositoryChange}
				variant="outline"
				class="font-montserrat bg-transparent border-none text-primary cursor-pointer"
				>Ganti Repository</Button
			>
		</div>
		<div class="flex flex-col gap-2 w-full py-3 border-muted/20">
			<p class="font-montserrat-medium">Nama Proyek</p>
			<input
				class={cn(
					'font-montserrat w-full px-4 rounded-lg bg-primary-50/40 border focus:ring-primary',
					touched.projectName && errors.projectName ? 'border-error' : 'border-muted/20'
				)}
				bind:value={wizard.projectName}
				onblur={() => (touched.projectName = true)}
			/>
			{#if touched.projectName && errors.projectName}
				<p class="text-sm text-error">{errors.projectName}</p>
			{:else}
				<p class="text-sm text-muted">
					Default diambil dari nama repository. Bisa diganti kapan saja lewat Settings setelah
					proyek dibuat.
				</p>
			{/if}
		</div>
		<div class="flex justify-between items-center w-full py-3 gap-2 border-muted/20">
			<div class="flex flex-col w-full gap-2">
				<p class="font-montserrat-medium">Branch</p>
				<Select
					options={branchOptions}
					bind:value={wizard.selectedBranch}
					variant="outline"
					iconPosition="end"
					class={cn(
						'w-full rounded-lg bg-primary-50/40 font-montserrat-medium border focus:ring focus:ring-primary px-3 xs:px-4 py-2',
						touched.branch && errors.branch ? 'border-error' : 'border-muted/20'
					)}
					labelClass="font-montserrat-medium"
					selectedLabelClass="font-montserrat-semibold bg-primary text-white"
					onblur={() => (touched.branch = true)}
				>
					{#snippet icon(open)}
						<CaretDownIcon
							class={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180')}
						/>
					{/snippet}
				</Select>
				{#if touched.branch && errors.branch}
					<p class="text-sm text-error">{errors.branch}</p>
				{/if}
			</div>
			<div class="flex flex-col w-full gap-2">
				<p class="font-montserrat-medium">Port</p>
				<input
					type="text"
					inputmode="numeric"
					pattern="[0-9]*"
					oninput={handlePortInput}
					onblur={() => (touched.port = true)}
					bind:value={wizard.selectedPort}
					class={cn(
						'font-montserrat w-full rounded-lg bg-primary-50/40 border focus:ring-primary',
						touched.port && errors.port ? 'border-error' : 'border-muted/20'
					)}
				/>
				{#if touched.port && errors.port}
					<p class="text-sm text-error">{errors.port}</p>
				{/if}
			</div>
		</div>
		<div class="flex flex-col gap-2 w-full py-3 border-muted/20">
			<p class="font-montserrat-medium">Build Command</p>
			<input
				class={cn(
					'font-montserrat w-full rounded-lg bg-primary-50/40 border focus:ring-primary',
					touched.buildCommand && errors.buildCommand ? 'border-error' : 'border-muted/20'
				)}
				bind:value={wizard.buildCommand}
				onblur={() => (touched.buildCommand = true)}
			/>
			{#if touched.buildCommand && errors.buildCommand}
				<p class="text-sm text-error">{errors.buildCommand}</p>
			{/if}
		</div>
		<div class="flex flex-col w-full py-3">
			<p class="font-montserrat-medium">Environment Variables (opsional)</p>

			<div class="flex flex-col gap-2 mt-2">
				{#each wizard.envVars as env (env.id)}
					<div class="flex w-full items-center gap-1 p-2">
						<p class="font-jetbrains-mono-semibold w-1/3 rounded-lg">
							{env.key}
						</p>

						<div class="flex w-full items-center gap-2">
							<p class="font-montserrat-medium text-md truncate text-muted w-full rounded-lg">
								{env.visible ? env.value : '••••••••••••'}
							</p>

							<Button
								variant="outline"
								class="border-none p-1"
								onclick={() => toggleEnvVisibility(env.id)}
								aria-label={env.visible ? 'Sembunyikan value' : 'Tampilkan value'}
							>
								{#if env.visible}
									<EyeSlashIcon class="h-4 w-4 text-muted" />
								{:else}
									<EyeIcon class="h-4 w-4 text-muted" />
								{/if}
							</Button>
						</div>

						<Button variant="outline" class="border-none" onclick={() => removeEnvVar(env.id)}>
							<span class="text-error">Hapus</span>
						</Button>
					</div>
				{/each}

				<div class="flex w-full gap-1 bg-primary-50 p-2">
					<input
						class="font-montserrat w-full rounded-lg border border-muted/20 focus:ring-primary"
						placeholder="NAMA_VARIABEL"
						bind:value={newEnv.key}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addEnvVar();
							}
						}}
					/>

					<input
						class="font-montserrat w-full rounded-lg border border-muted/20 focus:ring-primary"
						placeholder="Isi value"
						bind:value={newEnv.value}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addEnvVar();
							}
						}}
					/>

					<Button type="button" variant="primary" onclick={addEnvVar} disabled={!isNewEnvValid}>
						<PlusIcon class="h-5 w-5" />
					</Button>
				</div>
			</div>

			<p class="text-sm text-muted mt-1">
				Bisa ditambah/diedit kapan saja nanti lewat Settings, tidak wajib diisi sekarang.
			</p>
		</div>
	</Card>

	<Button
		type="submit"
		variant="primary"
		class="w-full py-3 cursor-pointer"
		disabled={isSubmitting}
	>
		{isSubmitting ? 'Membuat Proyek...' : 'Buat Proyek'}
	</Button>
	{#if error}
		<p class="text-sm text-red-500">{error}</p>
	{/if}
</form>
