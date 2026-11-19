<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { Database } from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createDeleteDatabaseMutation, createRenameDatabaseMutation } from '../mutations';
	import { DATABASE_NAME_MAX_LENGTH, databaseErrorMessage } from '../presentation';
	import { databasesHref } from '../routes';

	type Props = { database: Database; workspaceId: string };

	let { database, workspaceId }: Props = $props();

	const renameMutation = createRenameDatabaseMutation();
	const deleteMutation = createDeleteDatabaseMutation();

	let name = $state('');
	let nameError = $state<string | null>(null);
	let lastName = '';
	$effect(() => {
		// Follows the saved name, without undoing what the user is typing.
		if (database.name !== lastName) {
			lastName = database.name;
			name = database.name;
		}
	});

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(database.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(database.projects.length > 0);
	const alreadyDeleting = $derived(database.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === database.name);

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		nameError = null;
		if (!trimmed) {
			nameError = 'Isi nama database.';
			return;
		}
		if (trimmed.length > DATABASE_NAME_MAX_LENGTH) {
			nameError = `Nama database paling panjang ${DATABASE_NAME_MAX_LENGTH} karakter.`;
			return;
		}
		if (trimmed === database.name) return;
		try {
			await renameMutation.mutateAsync({ workspaceId, databaseId: database.id, name: trimmed });
			toast.success(`Nama database diganti menjadi ${trimmed}.`);
		} catch (error) {
			nameError =
				getFieldError(error, 'name') ??
				databaseErrorMessage(error, 'rename', 'Nama belum bisa diganti. Silakan coba lagi.');
		}
	}

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
				'Database belum bisa dihapus. Silakan coba lagi.'
			);
		}
	}
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="database-settings-title"
>
	<h2 id="database-settings-title" class="text-base text-foreground">Ganti nama</h2>
	<form class="flex flex-col gap-3" novalidate onsubmit={rename}>
		<FormField
			id="database-rename"
			label="Nama database"
			bind:value={name}
			hint="Nama di server database tidak ikut berubah."
			error={nameError}
			autocomplete="off"
			spellcheck={false}
			oninput={() => (nameError = null)}
		/>
		<Button
			type="submit"
			variant="secondary"
			size="sm"
			class="self-start"
			disabled={renameMutation.isPending || name.trim() === database.name}
		>
			{renameMutation.isPending ? 'Menyimpan...' : 'Simpan nama'}
		</Button>
	</form>
</section>

<section
	class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="database-danger-title"
	data-testid="database-danger-zone"
>
	<h2 id="database-danger-title" class="text-base text-error-dark">Hapus database</h2>
	<p class="text-sm text-foreground">
		Menghapus database dan semua datanya dari server. Tindakan ini tidak bisa dibatalkan.
	</p>
	{#if deleteBlocked}
		<p id="delete-blocked" class="text-sm text-foreground" data-testid="delete-blocked">
			Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
			semua proyek dulu, supaya aplikasi yang berjalan tidak kehilangan datanya tanpa sengaja.
		</p>
	{:else if alreadyDeleting}
		<p class="text-sm text-muted">Database ini sedang dihapus.</p>
	{/if}
	<Button
		variant="danger"
		size="sm"
		class="self-start"
		bind:ref={deleteTrigger}
		disabled={deleteBlocked}
		aria-describedby={deleteBlocked ? 'delete-blocked' : undefined}
		onclick={openDelete}
		data-testid="delete-database"
	>
		<Trash size={16} aria-hidden="true" />
		Hapus database
	</Button>
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
