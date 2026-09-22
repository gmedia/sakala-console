<script lang="ts">
	import {
		EyeIcon,
		EyeSlashIcon,
		CaretDownIcon,
		PlusIcon,
		CircleNotchIcon,
		WarningCircleIcon
	} from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import { getCreateProjectContext } from '$lib/features/projects/create/createProjectContext';
	import type { StoreProjectRequest } from '$lib/api/resources/projects';
	import {
		createProjectFormSchema,
		type CreateProjectFieldErrors
	} from '../../validation/createProjectSchema';
	import { sanitizePortInput } from '../../validation/configureProjectStep';

	type Props = {
		onSubmit: (payload: StoreProjectRequest) => void;
		onRepositoryChange: () => void;
		isSubmitting?: boolean;
		apiErrors?: CreateProjectFieldErrors;
	};

	let { onSubmit, onRepositoryChange, isSubmitting = false, apiErrors = {} }: Props = $props();

	const wizard = getCreateProjectContext();

	let touched = $state({
		projectName: false,
		branch: false,
		port: false,
		buildCommand: false
	});

	// Client-side validation using Zod
	const clientValidation = $derived.by(() => {
		const isGithub = wizard.repositorySource === 'github';
		const repo = wizard.selectedRepository;
		const installationId = wizard.selectedInstallationId;
		const numericRepoId = repo?.id ? Number(repo.id) : NaN;

		const repoPayload =
			isGithub && installationId && !isNaN(numericRepoId) && numericRepoId > 0
				? {
						type: 'github_installation' as const,
						installation_id: installationId,
						repository_id: numericRepoId
					}
				: {
						type: 'public_url' as const,
						url:
							wizard.repositorySource === 'git-url'
								? wizard.gitUrl.trim()
								: repo?.clone_url
									? repo.clone_url.replace(/\.git$/, '')
									: ''
					};

		const result = createProjectFormSchema.safeParse({
			name: wizard.projectName,
			branch: wizard.selectedBranch,
			repository: repoPayload
		});

		if (result.success) {
			return { isValid: true, errors: {}, payload: result.data };
		}

		const formatted = result.error.flatten().fieldErrors;
		return {
			isValid: false,
			errors: {
				name: formatted.name?.[0],
				branch: formatted.branch?.[0],
				repository: formatted.repository?.[0]
			},
			payload: null
		};
	});

	const fieldErrors = $derived({
		name: (touched.projectName && clientValidation.errors.name) || apiErrors.name,
		branch: (touched.branch && clientValidation.errors.branch) || apiErrors.branch,
		repository: clientValidation.errors.repository || apiErrors.repository
	});

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

		if (!clientValidation.isValid || !clientValidation.payload) {
			return;
		}

		const storePayload: StoreProjectRequest = {
			name: clientValidation.payload.name.trim(),
			branch: clientValidation.payload.branch.trim(),
			repository: clientValidation.payload.repository
		};

		onSubmit(storePayload);
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

<form class="flex flex-col mt-3 gap-4" onsubmit={handleSubmit} novalidate>
	<div>
		<p class="text-lg font-montserrat-semibold">Persiapan deployment</p>
		<p class="font-montserrat">Atur konfigurasi proyek sebelum dibuat.</p>
	</div>

	{#if apiErrors.general}
		<div
			class="flex items-start gap-3 rounded-lg border border-error/30 bg-error/10 p-4 text-error"
			role="alert"
			aria-live="assertive"
		>
			<WarningCircleIcon class="size-5 shrink-0 mt-0.5" />
			<div class="text-sm">
				<p class="font-montserrat-semibold">Gagal Membuat Proyek</p>
				<p class="mt-0.5 font-montserrat">{apiErrors.general}</p>
			</div>
		</div>
	{/if}

	<Card class="rounded-lg">
		<div
			class="flex justify-between items-center w-full bg-background rounded-lg py-1 px-4 border border-muted/20"
		>
			<p class="font-jetbrains-mono-medium">
				{wizard.selectedRepository?.full_name || wizard.gitUrl || 'Repository'}
			</p>
			<Button
				type="button"
				onclick={onRepositoryChange}
				variant="outline"
				class="font-montserrat bg-transparent border-none text-primary cursor-pointer"
			>
				Ganti Repository
			</Button>
		</div>

		{#if fieldErrors.repository}
			<p class="text-sm text-error px-1 mt-1">{fieldErrors.repository}</p>
		{/if}

		<div class="flex flex-col gap-2 w-full py-3 border-muted/20">
			<p class="font-montserrat-medium">Nama Proyek</p>
			<input
				class={cn(
					'font-montserrat w-full px-4 rounded-lg bg-primary-50/40 border focus:ring-primary',
					fieldErrors.name ? 'border-error ring-1 ring-error' : 'border-muted/20'
				)}
				bind:value={wizard.projectName}
				onblur={() => (touched.projectName = true)}
			/>
			{#if fieldErrors.name}
				<p class="text-sm text-error">{fieldErrors.name}</p>
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
						fieldErrors.branch ? 'border-error' : 'border-muted/20'
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
				{#if fieldErrors.branch}
					<p class="text-sm text-error">{fieldErrors.branch}</p>
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
					class="font-montserrat w-full rounded-lg bg-primary-50/40 border border-muted/20 focus:ring-primary"
				/>
			</div>
		</div>

		<div class="flex flex-col gap-2 w-full py-3 border-muted/20">
			<p class="font-montserrat-medium">Build Command</p>
			<input
				class="font-montserrat w-full rounded-lg bg-primary-50/40 border border-muted/20 focus:ring-primary"
				bind:value={wizard.buildCommand}
				onblur={() => (touched.buildCommand = true)}
			/>
		</div>

		<div class="flex flex-col w-full py-3">
			<p class="font-montserrat-medium">Environment Variables (opsional)</p>

			<div class="flex flex-col gap-2 mt-2">
				{#each wizard.envVars as env (env.id)}
					<div class="flex w-full items-center gap-1 p-2">
						<p class="font-jetbrains-mono-semibold w-1/3 rounded-lg truncate">
							{env.key}
						</p>

						<div class="flex w-full items-center gap-2">
							<p class="font-montserrat-medium text-md truncate text-muted w-full rounded-lg">
								{env.visible ? env.value : '••••••••••••'}
							</p>

							<Button
								type="button"
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

						<Button
							type="button"
							variant="outline"
							class="border-none"
							onclick={() => removeEnvVar(env.id)}
						>
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
		class="w-full py-3 cursor-pointer flex items-center justify-center gap-2"
		disabled={isSubmitting}
	>
		{#if isSubmitting}
			<CircleNotchIcon class="size-5 animate-spin" />
			<span>Membuat Proyek...</span>
		{:else}
			<span>Buat Proyek</span>
		{/if}
	</Button>
</form>
