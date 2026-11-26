<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import type { Database } from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createDeleteDatabaseMutation } from '../mutations';
	import { databaseErrorMessage } from '../presentation';
	import { databasesHref } from '../routes';

	/** Deleting the database: last on the page, after the panel on a narrow screen. */
	type Props = { database: Database; workspaceId: string };

	let { database, workspaceId }: Props = $props();

	const deleteMutation = createDeleteDatabaseMutation();

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(database.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(database.projects.length > 0);
	const alreadyDeleting = $derived(database.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === database.name);

	function openDelete() {
		confirmText = '';
		deleteError = null;
		deleteOpen = true;
	}

	async function remove() {
		if (!canConfirmDelete) return;
		deleteError = null;
		try {
			await deleteMutation.mutateAsync({ workspaceId, databaseId: database.id });
			deleteOpen = false;
			toast.success(`Database ${database.name} sedang dihapus.`);
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by databasesHref()
			await goto(databasesHref());
		} catch (error) {
			deleteError = databaseErrorMessage(
				error,
				'delete',
				'Database belum terhapus. Muat ulang halaman, lalu hapus lagi.'
			);
		}
	}
</script>

<section
	class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="database-danger-title"
	data-testid="database-danger-zone"
>
	<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
			<h2 id="database-danger-title" class="text-base text-error-dark">Hapus database</h2>
			<p class="text-sm text-foreground">
				Semua datanya ikut terhapus dan tidak bisa dikembalikan.
			</p>
		</div>
		<Button
			variant="danger"
			size="sm"
			bind:ref={deleteTrigger}
			disabled={deleteBlocked}
			aria-describedby={deleteBlocked ? 'delete-blocked' : undefined}
			onclick={openDelete}
			data-testid="delete-database"
		>
			<Trash size={16} aria-hidden="true" />
			Hapus database
		</Button>
	</div>
	{#if deleteBlocked}
		<p id="delete-blocked" class="text-sm text-foreground" data-testid="delete-blocked">
			Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
			semua proyek dulu.
		</p>
	{:else if alreadyDeleting}
		<p class="text-sm text-muted">Database ini sedang dihapus.</p>
	{/if}
</section>

<Dialog
	bind:open={deleteOpen}
	title={`Hapus ${database.name}?`}
	confirmLabel={deleteMutation.isPending ? 'Menghapus...' : 'Hapus database ini'}
	variant="destructive"
	loading={deleteMutation.isPending}
	confirmDisabled={!canConfirmDelete}
	initialFocus={() => confirmInput}
	returnFocus={() => deleteTrigger}
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg"
	onConfirm={remove}
>
	<div class="flex flex-col gap-3 text-sm text-foreground" data-testid="delete-dialog">
		<p>
			Database dan semua tabel serta datanya dihapus dari server database. Setelah itu tidak bisa
			dipulihkan dari Console.
		</p>
		<div class="flex flex-col gap-1.5">
			<label for="delete-database-confirm" class="font-medium">
				Ketik <strong class="font-mono font-semibold wrap-anywhere">{database.name}</strong> untuk konfirmasi
			</label>
			<input
				bind:this={confirmInput}
				bind:value={confirmText}
				id="delete-database-confirm"
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
