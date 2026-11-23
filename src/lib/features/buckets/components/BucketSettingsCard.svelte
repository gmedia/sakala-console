<script lang="ts">
	import { goto } from '$app/navigation';
	import Trash from 'phosphor-svelte/lib/Trash';
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { Bucket } from '$lib/api/resources/buckets';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import { createDeleteBucketMutation, createUpdateBucketMutation } from '../mutations';
	import {
		BUCKET_NAME_MAX_LENGTH,
		BUCKET_QUOTA_RANGE,
		BYTES_PER_MB,
		bucketErrorMessage,
		formatMegabytes,
		isOnNode
	} from '../presentation';
	import { bucketsHref } from '../routes';

	type Props = {
		bucket: Bucket;
		workspaceId: string;
		/** The most MB this bucket may have, its own quota included; `null` when the API decides. */
		maxQuotaMb: number | null;
	};

	let { bucket, workspaceId, maxQuotaMb }: Props = $props();

	const renameMutation = createUpdateBucketMutation();
	const quotaMutation = createUpdateBucketMutation();
	const deleteMutation = createDeleteBucketMutation();

	let name = $state('');
	let nameError = $state<string | null>(null);
	let lastName = '';
	$effect(() => {
		// Follows the saved name, without undoing what the user is typing.
		if (bucket.name !== lastName) {
			lastName = bucket.name;
			name = bucket.name;
		}
	});

	let quota = $state('');
	let quotaError = $state<string | null>(null);
	let lastQuota = -1;
	$effect(() => {
		if (bucket.quota_mb !== lastQuota) {
			lastQuota = bucket.quota_mb;
			quota = String(bucket.quota_mb);
		}
	});

	let deleteOpen = $state(false);
	let deleteTrigger = $state<HTMLElement | null>(null);
	let confirmText = $state('');
	let deleteError = $state<string | null>(null);
	let confirmInput = $state<HTMLInputElement>();

	const attachedNames = $derived(bucket.projects.map((project) => project.name).join(', '));
	const deleteBlocked = $derived(bucket.projects.length > 0);
	const alreadyDeleting = $derived(bucket.status === 'deleting');
	const canConfirmDelete = $derived(confirmText.trim() === bucket.name);

	// A quota change needs the bucket on the node and no other change on its way.
	const quotaBlocked = $derived.by(() => {
		if (!isOnNode(bucket)) return 'Kuota bisa diubah setelah bucket siap.';
		if (bucket.pending_quota_mb !== null) {
			return `Perubahan kuota ke ${formatMegabytes(bucket.pending_quota_mb)} masih diterapkan. Tunggu sampai selesai.`;
		}
		return null;
	});
	const quotaValue = $derived(Number(quota.trim()));
	const quotaMax = $derived(maxQuotaMb ?? BUCKET_QUOTA_RANGE.max);
	// Allowed by the API, but uploads are refused until the bucket holds less than its quota.
	const belowUsage = $derived(
		Number.isInteger(quotaValue) &&
			quotaValue > 0 &&
			bucket.size_bytes !== null &&
			quotaValue * BYTES_PER_MB < bucket.size_bytes
	);

	async function rename(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		nameError = null;
		if (!trimmed) {
			nameError = 'Isi nama bucket.';
			return;
		}
		if (trimmed.length > BUCKET_NAME_MAX_LENGTH) {
			nameError = `Nama bucket paling panjang ${BUCKET_NAME_MAX_LENGTH} karakter.`;
			return;
		}
		if (trimmed === bucket.name) return;
		try {
			await renameMutation.mutateAsync({
				workspaceId,
				bucketId: bucket.id,
				payload: { name: trimmed }
			});
			toast.success(`Nama bucket diganti menjadi ${trimmed}.`);
		} catch (error) {
			nameError =
				getFieldError(error, 'name') ??
				bucketErrorMessage(
					error,
					'rename',
					'Nama bucket belum diganti. Muat ulang halaman, lalu simpan lagi.'
				);
		}
	}

	async function changeQuota(event: SubmitEvent) {
		event.preventDefault();
		quotaError = null;
		if (quotaBlocked) return;
		const raw = quota.trim();
		if (!raw || !Number.isInteger(quotaValue) || quotaValue < BUCKET_QUOTA_RANGE.min) {
			quotaError = `Isi bilangan bulat dalam MB, paling kecil ${BUCKET_QUOTA_RANGE.min}.`;
			return;
		}
		if (quotaValue > quotaMax) {
			quotaError =
				maxQuotaMb === null
					? `Kuota paling besar ${formatMegabytes(quotaMax)}.`
					: `Jatah penyimpanan workspace cukup untuk paling besar ${formatMegabytes(quotaMax)} di bucket ini. Isi ${quotaMax} atau kurang.`;
			return;
		}
		if (quotaValue === bucket.quota_mb) return;
		try {
			await quotaMutation.mutateAsync({
				workspaceId,
				bucketId: bucket.id,
				payload: { quota_mb: quotaValue }
			});
			toast.success(`Kuota sedang diubah menjadi ${formatMegabytes(quotaValue)}.`);
		} catch (error) {
			quotaError =
				getFieldError(error, 'quota_mb') ??
				bucketErrorMessage(
					error,
					'quota',
					'Kuota belum diubah. Muat ulang halaman, lalu simpan lagi.'
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
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="bucket-settings-title"
>
	<h2 id="bucket-settings-title" class="text-base text-foreground">Ganti nama</h2>
	<form class="flex flex-col gap-3" novalidate onsubmit={rename}>
		<FormField
			id="bucket-rename"
			label="Nama bucket"
			bind:value={name}
			hint="Nama bucket di server dan variabel AWS_BUCKET tidak ikut berubah."
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
			disabled={renameMutation.isPending || name.trim() === bucket.name}
		>
			{renameMutation.isPending ? 'Menyimpan...' : 'Simpan nama'}
		</Button>
	</form>
</section>

<section
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="bucket-quota-title"
	data-testid="bucket-quota-settings"
>
	<h2 id="bucket-quota-title" class="text-base text-foreground">Ubah kuota</h2>
	<form class="flex flex-col gap-3" novalidate onsubmit={changeQuota}>
		<div class="flex flex-col gap-1.5">
			<label for="bucket-quota-change" class="text-sm font-medium text-foreground">Kuota (MB)</label
			>
			<input
				id="bucket-quota-change"
				type="text"
				inputmode="numeric"
				autocomplete="off"
				bind:value={quota}
				disabled={Boolean(quotaBlocked)}
				class="control-input tabular-nums"
				aria-invalid={quotaError ? 'true' : undefined}
				aria-describedby={quotaError ? 'bucket-quota-change-error' : 'bucket-quota-change-hint'}
				oninput={() => (quotaError = null)}
			/>
			{#if quotaError}
				<p id="bucket-quota-change-error" class="text-xs text-error-dark" role="alert">
					{quotaError}
				</p>
			{:else}
				<p id="bucket-quota-change-hint" class="text-xs text-foreground/70">
					{quotaBlocked ??
						(maxQuotaMb === null
							? 'Kuota diambil dari jatah penyimpanan workspace.'
							: `Paling besar ${formatMegabytes(maxQuotaMb)} dari jatah penyimpanan workspace.`)}
				</p>
			{/if}
		</div>
		{#if belowUsage && !quotaError}
			<p
				class="rounded-control border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground"
				role="status"
				data-testid="bucket-quota-below-usage"
			>
				Kuota ini lebih kecil dari isi bucket sekarang. Upload baru ditolak sampai ada berkas yang
				dihapus dan isinya di bawah kuota.
			</p>
		{/if}
		<Button
			type="submit"
			variant="secondary"
			size="sm"
			class="self-start"
			disabled={quotaMutation.isPending ||
				Boolean(quotaBlocked) ||
				quota.trim() === String(bucket.quota_mb)}
		>
			{quotaMutation.isPending ? 'Menyimpan...' : 'Simpan kuota'}
		</Button>
	</form>
</section>

<section
	class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4 sm:p-5"
	aria-labelledby="bucket-danger-title"
	data-testid="bucket-danger-zone"
>
	<h2 id="bucket-danger-title" class="text-base text-error-dark">Hapus bucket</h2>
	<p class="text-sm text-foreground">
		Menghapus bucket dan semua berkas di dalamnya dari server. Tindakan ini tidak bisa dibatalkan.
	</p>
	{#if deleteBlocked}
		<p
			id="bucket-delete-blocked"
			class="text-sm text-foreground"
			data-testid="bucket-delete-blocked"
		>
			Masih dipasang ke <span class="font-medium wrap-anywhere">{attachedNames}</span>. Lepas dari
			semua proyek dulu, supaya aplikasi yang berjalan tidak kehilangan berkasnya tanpa sengaja.
		</p>
	{:else if alreadyDeleting}
		<p class="text-sm text-muted">Bucket ini sedang dihapus.</p>
	{/if}
	<Button
		variant="danger"
		size="sm"
		class="self-start"
		bind:ref={deleteTrigger}
		disabled={deleteBlocked}
		aria-describedby={deleteBlocked ? 'bucket-delete-blocked' : undefined}
		onclick={openDelete}
		data-testid="delete-bucket"
	>
		<Trash size={16} aria-hidden="true" />
		Hapus bucket
	</Button>
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
