<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import type { Bucket } from '$lib/api/resources/buckets';
	import InlineEditor from '$lib/components/ui/InlineEditor.svelte';
	import { createUpdateBucketMutation } from '../mutations';
	import {
		BUCKET_QUOTA_RANGE,
		BYTES_PER_MB,
		bucketErrorMessage,
		formatMegabytes,
		isOnNode
	} from '../presentation';

	/** Changing the quota in place, opened from "Ubah" beside the quota under the bucket's name. */
	type Props = {
		id: string;
		bucket: Bucket;
		workspaceId: string;
		/** The most MB this bucket may have, its own quota included; `null` when the API decides. */
		maxQuotaMb: number | null;
		onClose: () => void;
	};

	let { id, bucket, workspaceId, maxQuotaMb, onClose }: Props = $props();

	const quotaMutation = createUpdateBucketMutation();

	// Starts from the saved quota; the editor opens fresh each time.
	// svelte-ignore state_referenced_locally
	let quota = $state(String(bucket.quota_mb));
	let quotaError = $state<string | null>(null);

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
		if (quotaValue === bucket.quota_mb) {
			onClose();
			return;
		}
		try {
			await quotaMutation.mutateAsync({
				workspaceId,
				bucketId: bucket.id,
				payload: { quota_mb: quotaValue }
			});
			toast.success(`Kuota sedang diubah menjadi ${formatMegabytes(quotaValue)}.`);
			onClose();
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
</script>

<InlineEditor
	{id}
	label="Ubah kuota bucket"
	onsubmit={changeQuota}
	onCancel={onClose}
	pending={quotaMutation.isPending}
	submitDisabled={Boolean(quotaBlocked) || quota.trim() === String(bucket.quota_mb)}
	submitLabel="Simpan kuota"
	testid="bucket-quota-settings"
>
	<div class="flex max-w-xs flex-col gap-1.5">
		<label for="bucket-quota-change" class="text-sm font-medium text-foreground">Kuota (MB)</label>
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
</InlineEditor>
