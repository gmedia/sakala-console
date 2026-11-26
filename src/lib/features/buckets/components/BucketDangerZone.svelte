<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import type { Bucket } from '$lib/api/resources/buckets';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createDeleteBucketMutation } from '../mutations';
	import { bucketErrorMessage } from '../presentation';
	import { bucketsHref } from '../routes';

	/** Deleting the bucket: last on the page, after the panel on a narrow screen. */
	type Props = { bucket: Bucket; workspaceId: string };

	let { bucket, workspaceId }: Props = $props();

	const deleteMutation = createDeleteBucketMutation();

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(bucket.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(bucket.projects.length > 0);
	const alreadyDeleting = $derived(bucket.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === bucket.name);

	function openDelete() {
		confirmText = '';
		deleteError = null;
		deleteOpen = true;
	}

	async function remove() {
		if (!canConfirmDelete) return;
		deleteError = null;
		try {
			await deleteMutation.mutateAsync({ workspaceId, bucketId: bucket.id });
			deleteOpen = false;
			toast.success(`Bucket ${bucket.name} sedang dihapus.`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by bucketsHref()
			await goto(bucketsHref());
		} catch (error) {
			deleteError = bucketErrorMessage(
				error,
				'delete',
				'Bucket belum terhapus. Muat ulang halaman, lalu hapus lagi.'
			);
		}
	}
</script>

<section
	class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="bucket-danger-title"
	data-testid="bucket-danger-zone"
>
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
			<h2 id="bucket-danger-title" class="text-base text-error-dark">Hapus bucket</h2>
			<p class="text-sm text-foreground">
				Semua berkasnya ikut terhapus dan tidak bisa dikembalikan.
			</p>
		</div>
		<Button
			variant="danger"
			size="sm"
			bind:ref={deleteTrigger}
			disabled={deleteBlocked}
			aria-describedby={deleteBlocked ? 'bucket-delete-blocked' : undefined}
			onclick={openDelete}
			data-testid="delete-bucket"
		>
			<Trash size={16} aria-hidden="true" />
			Hapus bucket
		</Button>
	</div>
	{#if deleteBlocked}
		<p
			id="bucket-delete-blocked"
			class="text-sm text-foreground"
			data-testid="bucket-delete-blocked"
		>
			Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
			semua proyek dulu.
		</p>
	{:else if alreadyDeleting}
		<p class="text-sm text-muted">Bucket ini sedang dihapus.</p>
	{/if}
</section>

<Dialog
	bind:open={deleteOpen}
	title={`Hapus ${bucket.name}?`}
	confirmLabel={deleteMutation.isPending ? 'Menghapus...' : 'Hapus bucket ini'}
	variant="destructive"
	loading={deleteMutation.isPending}
	confirmDisabled={!canConfirmDelete}
	initialFocus={() => confirmInput}
	returnFocus={() => deleteTrigger}
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg"
	onConfirm={remove}
>
	<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="delete-bucket-dialog">
		<p>
			Bucket dan semua berkasnya dihapus dari server penyimpanan saat itu juga, dan secret key-nya
			berhenti berlaku. Setelah itu tidak bisa dipulihkan dari Console. Backup operator menyimpan
			salinan paling lama sekitar dua minggu.
		</p>
		<div class="flex flex-col gap-1.5">
			<label for="delete-bucket-confirm" class="font-medium">
				Ketik <strong class="font-mono font-semibold wrap-anywhere">{bucket.name}</strong> untuk konfirmasi
			</label>
			<input
				bind:this={confirmInput}
				bind:value={confirmText}
				id="delete-bucket-confirm"
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
