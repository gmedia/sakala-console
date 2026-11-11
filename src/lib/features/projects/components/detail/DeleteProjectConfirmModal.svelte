<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type Props = {
		open: boolean;
		projectName: string;
		defaultDomain?: string;
		deploymentCount?: number;
		/** From the API. Without it the dialog says less rather than quote a number it does not know. */
		retentionDays?: number;
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
		retentionDays,
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
		class="mb-4 flex size-12 shrink-0 items-center justify-center rounded-full bg-error-50 text-error"
	>
		<Trash size={24} aria-hidden="true" />
	</div>
{/snippet}

{#snippet title()}
	Hapus proyek <span class="font-mono font-semibold">{projectName}</span>?
{/snippet}

{#snippet description()}
	Tindakan ini tidak bisa dibatalkan. Semua data berikut akan ikut terhapus:
{/snippet}

<Dialog
	{open}
	{icon}
	{title}
	{description}
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg"
	confirmLabel="Hapus proyek ini"
	variant="destructive"
	initialFocus={() => inputEl}
	confirmDisabled={!canDelete}
	loading={isLoading}
	onConfirm={handleConfirm}
	onCancel={handleClose}
>
	<ul class="list-inside list-disc space-y-1 text-sm text-foreground">
		<li>Semua riwayat deployment {deploymentCount > 0 ? `(${deploymentCount} deployment)` : ''}</li>
		<li class="wrap-anywhere">Domain publik {defaultDomain || 'yang terhubung'}</li>
		<li>Semua environment variable</li>
	</ul>

	<p class="mt-3 text-sm text-foreground" data-testid="delete-project-retention">
		{#if retentionDays !== undefined}
			Datanya disimpan {retentionDays} hari lalu dihapus permanen, dan selama itu proyek ini tidak bisa
			dipulihkan. Alamatnya tidak bisa dipakai lagi.
		{:else}
			Datanya dihapus permanen setelah masa simpannya berakhir, dan selama itu proyek ini tidak bisa
			dipulihkan. Alamatnya tidak bisa dipakai lagi.
		{/if}
	</p>

	<div class="mt-6 flex flex-col">
		<label for="confirmInput" class="mb-1.5 text-sm font-medium text-foreground">
			Ketik <strong class="font-mono font-semibold wrap-anywhere">{projectName}</strong> untuk konfirmasi
		</label>
		<input
			bind:this={inputEl}
			bind:value={confirmInput}
			onkeydown={handleInputKeydown}
			type="text"
			id="confirmInput"
			placeholder={projectName}
			autocomplete="off"
			disabled={isLoading}
			class="control-input font-mono"
		/>
	</div>

	{#if error}
		<p role="alert" class="mt-3 text-sm text-error-dark">{error}</p>
	{/if}
</Dialog>
