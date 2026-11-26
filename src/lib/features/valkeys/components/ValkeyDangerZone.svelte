<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import { VALKEY_MODE, type Valkey } from '$lib/api/resources/valkeys';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createDeleteValkeyMutation } from '../mutations';
	import { valkeyErrorMessage } from '../presentation';
	import { valkeysHref } from '../routes';

	/** Deleting the store: last on the page, after the panel on a narrow screen. */
	type Props = { valkey: Valkey; workspaceId: string };

	let { valkey, workspaceId }: Props = $props();

	const deleteMutation = createDeleteValkeyMutation();

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(valkey.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(valkey.projects.length > 0);
	const alreadyDeleting = $derived(valkey.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === valkey.name);

	function openDelete() {
		confirmText = '';
		deleteError = null;
		deleteOpen = true;
	}

	async function remove() {
		if (!canConfirmDelete) return;
		deleteError = null;
		try {
			await deleteMutation.mutateAsync({ workspaceId, valkeyId: valkey.id });
			deleteOpen = false;
			toast.success(`Valkey ${valkey.name} sedang dihapus.`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by valkeysHref()
			await goto(valkeysHref());
		} catch (error) {
			deleteError = valkeyErrorMessage(
				error,
				'delete',
				'Valkey belum terhapus. Muat ulang halaman, lalu hapus lagi.'
			);
		}
	}
</script>

<section
	class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="valkey-danger-title"
	data-testid="valkey-danger-zone"
>
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
			<h2 id="valkey-danger-title" class="text-base text-error-dark">Hapus Valkey</h2>
			<p class="text-sm text-foreground">
				Semua datanya ikut terhapus dan tidak bisa dikembalikan.
			</p>
		</div>
		<Button
			variant="danger"
			size="sm"
			bind:ref={deleteTrigger}
			disabled={deleteBlocked}
			aria-describedby={deleteBlocked ? 'valkey-delete-blocked' : undefined}
			onclick={openDelete}
			data-testid="delete-valkey"
		>
			<Trash size={16} aria-hidden="true" />
			Hapus Valkey
		</Button>
	</div>
	{#if deleteBlocked}
		<p
			id="valkey-delete-blocked"
			class="text-sm text-foreground"
			data-testid="valkey-delete-blocked"
		>
			Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
			semua proyek dan redeploy proyeknya dulu.
		</p>
	{:else if alreadyDeleting}
		<p class="text-sm text-muted">
			Valkey ini sedang dihapus. Kalau tidak selesai, kemungkinan masih ada proyek yang dilepas
			tetapi belum di-redeploy. Redeploy proyek itu, lalu hapus lagi.
		</p>
	{/if}
</section>

<Dialog
	bind:open={deleteOpen}
	title={`Hapus ${valkey.name}?`}
	confirmLabel={deleteMutation.isPending ? 'Menghapus...' : 'Hapus Valkey ini'}
	variant="destructive"
	loading={deleteMutation.isPending}
	confirmDisabled={!canConfirmDelete}
	initialFocus={() => confirmInput}
	returnFocus={() => deleteTrigger}
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg"
	onConfirm={remove}
>
	<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="delete-valkey-dialog">
		<p>
			Valkey dan semua datanya dihapus dari server, dan password-nya berhenti berlaku. Setelah itu
			tidak bisa dipulihkan dari Console.
			{#if valkey.mode === VALKEY_MODE.persistent}
				Backup operator menyimpan salinan sekitar dua minggu.
			{/if}
		</p>
		<div class="flex flex-col gap-1.5">
			<label for="delete-valkey-confirm" class="font-medium">
				Ketik <strong class="font-mono font-semibold wrap-anywhere">{valkey.name}</strong> untuk konfirmasi
			</label>
			<input
				bind:this={confirmInput}
				bind:value={confirmText}
				id="delete-valkey-confirm"
				type="text"
				autocomplete="off"
				spellcheck="false"
				class="control-input font-mono"
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						void remove();
					}
				}}
			/>
		</div>
		{#if deleteError}
			<p role="alert" class="text-error-dark">{deleteError}</p>
		{/if}
	</div>
</Dialog>
