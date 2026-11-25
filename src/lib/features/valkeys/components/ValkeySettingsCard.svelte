<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import { VALKEY_MODE, type Valkey } from '$lib/api/resources/valkeys';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { createDeleteValkeyMutation, createUpdateValkeyMutation } from '../mutations';
	import {
		BYTES_PER_MB,
		VALKEY_NAME_MAX_LENGTH,
		formatMegabytes,
		isOnNode,
		sizeOptions,
		valkeyErrorMessage
	} from '../presentation';
	import { valkeysHref } from '../routes';
	import ValkeySizeOptions from './ValkeySizeOptions.svelte';
	import { VALKEY_ANCHORS } from '../panel';

	type Props = {
		valkey: Valkey;
		/**
		 * Which part to show: the edits (rename, resize) go in the page's column and the delete last,
		 * after the panel on a narrow screen (docs/UI_GUIDELINES.md). Both by default.
		 */
		parts?: 'all' | 'edit' | 'delete';
		workspaceId: string;
		sizes: number[];
		/** MB the workspace may still reserve besides this store; `null` when the API decides. */
		availableMb: number | null;
	};

	let { valkey, workspaceId, sizes, availableMb, parts = 'all' }: Props = $props();

	const showEdit = $derived(parts !== 'delete');
	const showDelete = $derived(parts !== 'edit');

	const renameMutation = createUpdateValkeyMutation();
	const resizeMutation = createUpdateValkeyMutation();
	const deleteMutation = createDeleteValkeyMutation();

	let name = $state('');
	let nameError = $state<string | null>(null);
	let lastName = '';
	$effect(() => {
		// Follows the saved name, without undoing what the user is typing.
		if (valkey.name !== lastName) {
			lastName = valkey.name;
			name = valkey.name;
		}
	});

	let size = $state(0);
	let sizeError = $state<string | null>(null);
	let lastSize = -1;
	$effect(() => {
		if (valkey.maxmemory_mb !== lastSize) {
			lastSize = valkey.maxmemory_mb;
			size = valkey.maxmemory_mb;
		}
	});

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(valkey.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(valkey.projects.length > 0);
	const alreadyDeleting = $derived(valkey.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === valkey.name);

	// A resize needs the store on its node and no other change on its way.
	const resizeBlocked = $derived.by(() => {
		if (!isOnNode(valkey)) return 'Ukuran bisa diubah setelah Valkey siap.';
		if (valkey.pending_maxmemory_mb !== null) {
			return `Perubahan ukuran ke ${formatMegabytes(valkey.pending_maxmemory_mb)} masih diterapkan. Tunggu sampai selesai.`;
		}
		return null;
	});
	const options = $derived(sizeOptions(sizes, availableMb, valkey.maxmemory_mb));
	const shrinking = $derived(size < valkey.maxmemory_mb);
	const belowUsage = $derived(
		shrinking &&
			valkey.usage.used_memory_bytes !== null &&
			size * BYTES_PER_MB < valkey.usage.used_memory_bytes
	);
	const resizeHint = $derived(
		resizeBlocked ??
			(availableMb === null
				? 'Memperbesar mengambil jatah memori workspace.'
				: `Memperbesar mengambil jatah memori workspace. Sisa jatah: ${formatMegabytes(availableMb)}.`)
	);

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		nameError = null;
		if (!trimmed) {
			nameError = 'Isi nama Valkey.';
			return;
		}
		if (trimmed.length > VALKEY_NAME_MAX_LENGTH) {
			nameError = `Nama Valkey paling panjang ${VALKEY_NAME_MAX_LENGTH} karakter.`;
			return;
		}
		if (trimmed === valkey.name) return;
		try {
			await renameMutation.mutateAsync({
				workspaceId,
				valkeyId: valkey.id,
				payload: { name: trimmed }
			});
			toast.success(`Nama Valkey diganti menjadi ${trimmed}.`);
		} catch (error) {
			nameError =
				getFieldError(error, 'name') ??
				valkeyErrorMessage(
					error,
					'rename',
					'Nama Valkey belum diganti. Muat ulang halaman, lalu simpan lagi.'
				);
		}
	}

	async function resize(event: SubmitEvent) {
		event.preventDefault();
		sizeError = null;
		if (resizeBlocked || size === valkey.maxmemory_mb) return;
		try {
			await resizeMutation.mutateAsync({
				workspaceId,
				valkeyId: valkey.id,
				payload: { maxmemory_mb: size }
			});
			toast.success(`Ukuran sedang diubah menjadi ${formatMegabytes(size)}.`);
		} catch (error) {
			sizeError =
				getFieldError(error, 'maxmemory_mb') ??
				valkeyErrorMessage(
					error,
					'resize',
					'Ukuran belum diubah. Muat ulang halaman, lalu simpan lagi.'
				);
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

{#if showEdit}
	<section
		class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
		aria-labelledby="valkey-settings-title"
	>
		<h2 id="valkey-settings-title" class="text-base text-foreground">Ganti nama</h2>
		<form class="flex flex-col gap-3" novalidate onsubmit={rename}>
			<FormField
				id="valkey-rename"
				label="Nama Valkey"
				bind:value={name}
				hint="Hanya nama tampilan. Koneksi dan variabel proyek tidak berubah."
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
				disabled={renameMutation.isPending || name.trim() === valkey.name}
			>
				{renameMutation.isPending ? 'Menyimpan...' : 'Simpan nama'}
			</Button>
		</form>
	</section>

	<section
		id={VALKEY_ANCHORS.resize}
		class="surface-card flex min-w-0 scroll-mt-4 flex-col gap-3 p-4 sm:p-5"
		aria-labelledby="valkey-resize-title"
		data-testid="valkey-resize"
	>
		<h2 id="valkey-resize-title" class="text-base text-foreground">Ubah ukuran</h2>
		<form class="flex flex-col gap-3" novalidate onsubmit={resize}>
			<ValkeySizeOptions
				bind:value={size}
				{options}
				legend="Ukuran"
				hint={resizeHint}
				error={sizeError}
				disabled={Boolean(resizeBlocked)}
			/>
			{#if shrinking && !sizeError}
				<p
					class="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground"
					role="status"
					data-testid="valkey-resize-shrink"
				>
					{#if valkey.mode === VALKEY_MODE.cache}
						Mengecilkan Valkey cache membuang key yang paling lama tidak dipakai sampai isinya muat.
					{:else if belowUsage}
						Data di Valkey ini lebih besar dari {formatMegabytes(size)}, jadi permintaan ini akan
						ditolak. Hapus sebagian data dulu, atau pilih ukuran yang lebih besar.
					{:else}
						Valkey persisten hanya bisa dikecilkan selama datanya masih muat.
					{/if}
				</p>
			{/if}
			<LearnMore topic="mengubah ukuran Valkey">
				<p>
					Kalau server tidak bisa mengubah batas memori di tempat, Valkey di-restart sebentar. Mode
					cache kosong lagi setelah restart; mode persisten memuat datanya lagi.
				</p>
			</LearnMore>
			<Button
				type="submit"
				variant="secondary"
				size="sm"
				class="self-start"
				disabled={resizeMutation.isPending ||
					Boolean(resizeBlocked) ||
					size === valkey.maxmemory_mb}
				data-testid="save-valkey-size"
			>
				{resizeMutation.isPending ? 'Menyimpan...' : 'Simpan ukuran'}
			</Button>
		</form>
	</section>
{/if}

{#if showDelete}
	<section
		class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
		aria-labelledby="valkey-danger-title"
		data-testid="valkey-danger-zone"
	>
		<h2 id="valkey-danger-title" class="text-base text-error-dark">Hapus Valkey</h2>
		<p class="text-sm text-foreground">
			Menghapus Valkey beserta semua datanya. Tindakan ini tidak bisa dibatalkan dari Console.
		</p>
		{#if deleteBlocked}
			<p
				id="valkey-delete-blocked"
				class="text-sm text-foreground"
				data-testid="valkey-delete-blocked"
			>
				Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
				semua proyek dulu, lalu redeploy proyeknya, supaya aplikasi yang berjalan tidak kehilangan
				antrean atau sesinya tanpa sengaja.
			</p>
		{:else if alreadyDeleting}
			<p class="text-sm text-muted">
				Valkey ini sedang dihapus. Kalau tidak selesai, kemungkinan masih ada proyek yang dilepas
				tetapi belum di-redeploy. Redeploy proyek itu, lalu hapus lagi.
			</p>
		{/if}
		<Button
			variant="danger"
			size="sm"
			class="self-start"
			bind:ref={deleteTrigger}
			disabled={deleteBlocked}
			aria-describedby={deleteBlocked ? 'valkey-delete-blocked' : undefined}
			onclick={openDelete}
			data-testid="delete-valkey"
		>
			<Trash size={16} aria-hidden="true" />
			Hapus Valkey
		</Button>
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
{/if}
