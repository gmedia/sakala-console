<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type Props = {
		open: boolean;
		projectName: string;
		defaultDomain?: string;
		deploymentCount?: number;
		isLoading?: boolean;
		error?: string;
		onConfirm: () => void;
		onClose: () => void;
	};

	let {
		open = false,
		projectName,
		defaultDomain,
		deploymentCount = 0,
		isLoading = false,
		error = '',
		onConfirm,
		onClose
	}: Props = $props();

	let confirmInput = $state('');
	let inputEl = $state<HTMLInputElement>();

	const canDelete = $derived(
		confirmInput.trim().toLowerCase() === projectName.trim().toLowerCase()
	);

	function handleClose() {
		confirmInput = '';
		onClose();
	}

	function handleConfirm() {
		if (!canDelete || isLoading) return;
		onConfirm();
	}

	function handleInputKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		handleConfirm();
	}
</script>

{#snippet icon()}
	<div
		class="mb-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-error-50 text-error sm:size-16"
	>
		<Trash size={32} weight="regular" />
	</div>
{/snippet}

{#snippet title()}
	Hapus proyek <span class="font-jetbrains-mono-semibold font-bold">{projectName}</span>?
{/snippet}

{#snippet description()}
	Tindakan ini <strong class="font-bold text-foreground">permanen</strong> dan tidak bisa dibatalkan.
	Semua data berikut akan ikut terhapus:
{/snippet}

<Dialog
	{open}
	{icon}
	{title}
	{description}
	titleClass="font-bold text-xl leading-tight sm:text-2xl 2xl:text-[28px]"
	descriptionClass="mt-3 text-sm leading-snug text-foreground/70 sm:text-base 2xl:text-[20px]"
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg rounded-2xl p-6 sm:p-8 2xl:max-w-142.5"
	confirmLabel="Hapus proyek ini"
	variant="destructive"
	initialFocus={() => inputEl}
	confirmDisabled={!canDelete}
	loading={isLoading}
	onConfirm={handleConfirm}
	onCancel={handleClose}
>
	<ul
		class="list-inside list-disc space-y-1 font-montserrat text-sm leading-snug text-foreground/70 sm:text-base 2xl:text-[20px]"
	>
		<li>Semua riwayat deployment {deploymentCount > 0 ? `(${deploymentCount} deployment)` : ''}</li>
		<li class="wrap-anywhere">Domain publik {defaultDomain || 'yang terhubung'}</li>
		<li>Semua environment variable</li>
	</ul>

	<div class="mt-6 flex flex-col">
		<label
			for="confirmInput"
			class="mb-2 font-montserrat text-sm leading-snug text-foreground sm:text-base 2xl:text-[20px]"
		>
			Ketik <strong class="font-jetbrains-mono-semibold font-bold wrap-anywhere"
				>{projectName}</strong
			> untuk konfirmasi
		</label>
		<input
			bind:this={inputEl}
			bind:value={confirmInput}
			onkeydown={handleInputKeydown}
			type="text"
			id="confirmInput"
			placeholder="contoh: nama-project"
			autocomplete="off"
			disabled={isLoading}
			class="h-12 w-full rounded-lg border border-border-strong bg-background px-4 font-jetbrains-mono-regular text-sm text-foreground transition-colors outline-none focus:border-primary disabled:opacity-50 sm:text-base"
		/>
	</div>

	{#if error}
		<p role="alert" class="mt-3 font-montserrat text-sm text-error-dark">{error}</p>
	{/if}
</Dialog>
