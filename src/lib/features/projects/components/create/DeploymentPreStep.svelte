<script lang="ts">
	import { EyeIcon, EyeSlashIcon, CaretDownIcon, PlusIcon } from 'phosphor-svelte';
	import { cn } from '$lib/utils/cn';
	import Button from '$lib/components/ui/Button.svelte';
	import type { Repository } from '../../type';
	import Card from '$lib/components/ui/Card.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	type Props = {
		repository: Repository | null;
		branch: string;
		port: string;
		projectName?: string;
		onNext: () => void;
		onRepositoryChange: () => void;
	};

	let {
		repository = $bindable(),
		branch = $bindable(),
		port = $bindable(),
		projectName = $bindable(''),
		onNext,
		onRepositoryChange
	}: Props = $props();

	type EnvVar = { id: string; key: string; value: string; visible?: boolean };

	let envVars = $state<EnvVar[]>([]);

	let newEnv = $state({
		key: '',
		value: ''
	});

	const isNewEnvValid = $derived(newEnv.key.trim() !== '' && newEnv.value.trim() !== '');

	function addEnvVar() {
		const key = newEnv.key.trim();
		const value = newEnv.value.trim();

		if (!key || !value) return;

		envVars.push({
			id: crypto.randomUUID(),
			key,
			value,
			visible: false
		});

		newEnv.key = '';
		newEnv.value = '';
	}

	function toggleEnvVisibility(index: number) {
		envVars[index].visible = !envVars[index].visible;
	}

	function removeEnvVar(index: number) {
		envVars.splice(index, 1);
	}

	const branchOptions = $derived.by(() => {
		const base: { label: string; value: string }[] = [
			{ label: 'main', value: 'main' },
			{ label: 'develop', value: 'develop' }
		];

		const defaultBranch = repository?.default_branch;
		if (defaultBranch && !base.some((opt) => opt.value === defaultBranch)) {
			base.unshift({ label: defaultBranch, value: defaultBranch });
		}

		return base;
	});

	$effect(() => {
		projectName = repository?.full_name.split('/')[1] ?? '';
	});
</script>

<div class="flex flex-col mt-3 gap-4">
	<div>
		<p class="text-lg font-montserrat-semibold">Persiapan deployment</p>
		<p class="font-montserrat">Atur konfigurasi proyek sebelum dibuat.</p>
	</div>

	<Card class="rounded-lg">
		<div
			class="flex justify-between items-center w-full bg-background rounded-lg py-1 px-4 border border-muted/20"
		>
			<p class="font-jetbrains-mono-medium">{repository?.full_name || 'Repository'}</p>
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
				class="font-montserrat w-full px-4 rounded-lg bg-primary-50/40 border border-muted/20 focus:ring-primary"
				bind:value={projectName}
			/>
			<p class="text-sm text-muted">
				Default diambil dari nama repository. Bisa diganti kapan saja lewat Settings setelah proyek
				dibuat.
			</p>
		</div>
		<div class="flex justify-between items-center w-full py-3 gap-2 border-muted/20">
			<div class="flex flex-col w-full gap-2">
				<p class="font-montserrat-medium">Branch</p>
				<Select
					options={branchOptions}
					bind:value={branch}
					variant="outline"
					iconPosition="end"
					class="w-full rounded-lg bg-primary-50/40 font-montserrat-medium border border-muted/20 focus:ring focus:ring-primary px-3 xs:px-4 py-2"
					labelClass="font-montserrat-medium"
					selectedLabelClass="font-montserrat-semibold bg-primary text-white"
				>
					{#snippet icon(open)}
						<CaretDownIcon
							class={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180')}
						/>
					{/snippet}
				</Select>
			</div>
			<div class="flex flex-col w-full gap-2">
				<p class="font-montserrat-medium">Port</p>
				<input
					type="text"
					bind:value={port}
					class="font-montserrat w-full rounded-lg bg-primary-50/40 border border-muted/20 focus:ring-primary"
				/>
			</div>
		</div>
		<div class="flex flex-col gap-2 w-full py-3 border-muted/20">
			<p class="font-montserrat-medium">Build Command</p>
			<input
				class="font-montserrat w-full rounded-lg bg-primary-50/40 border border-muted/20 focus:ring-primary"
				value="npm run build"
			/>
		</div>
		<div class="flex flex-col w-full py-3">
			<p class="font-montserrat-medium">Environment Variables (opsional)</p>

			<div class="flex flex-col gap-2 mt-2">
				{#each envVars as env, i (env.id)}
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
								onclick={() => toggleEnvVisibility(i)}
								aria-label={env.visible ? 'Sembunyikan value' : 'Tampilkan value'}
							>
								{#if env.visible}
									<EyeSlashIcon class="h-4 w-4 text-muted" />
								{:else}
									<EyeIcon class="h-4 w-4 text-muted" />
								{/if}
							</Button>
						</div>

						<Button variant="outline" class="border-none" onclick={() => removeEnvVar(i)}>
							<span class="text-error">Hapus</span>
						</Button>
					</div>
				{/each}

				<div class="flex w-full gap-1 bg-primary-50 p-2">
					<input
						class="font-montserrat w-full rounded-lg border border-muted/20 focus:ring-primary"
						placeholder="NAMA_VARIABEL"
						bind:value={newEnv.key}
						onkeydown={(e) => e.key === 'Enter' && addEnvVar()}
					/>

					<input
						class="font-montserrat w-full rounded-lg border border-muted/20 focus:ring-primary"
						placeholder="Isi value"
						bind:value={newEnv.value}
						onkeydown={(e) => e.key === 'Enter' && addEnvVar()}
					/>

					<Button variant="primary" onclick={addEnvVar} disabled={!isNewEnvValid}>
						<PlusIcon class="h-5 w-5" />
					</Button>
				</div>
			</div>

			<p class="text-sm text-muted mt-1">
				Bisa ditambah/diedit kapan saja nanti lewat Settings, tidak wajib diisi sekarang.
			</p>
		</div>
	</Card>

	<Button variant="primary" class="w-full py-3 cursor-pointer" onclick={onNext}>Buat Proyek</Button>
</div>
