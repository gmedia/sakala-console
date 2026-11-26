<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import { VALKEY_MODE, type Valkey } from '$lib/api/resources/valkeys';
	import InlineEditor from '$lib/components/ui/InlineEditor.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { createUpdateValkeyMutation } from '../mutations';
	import {
		BYTES_PER_MB,
		formatMegabytes,
		isOnNode,
		sizeOptions,
		valkeyErrorMessage
	} from '../presentation';
	import ValkeySizeOptions from './ValkeySizeOptions.svelte';

	/** Resizing in place, opened from "Ubah" beside the size under the store's name. */
	type Props = {
		id: string;
		valkey: Valkey;
		workspaceId: string;
		sizes: number[];
		/** MB the workspace may still reserve besides this store; `null` when the API decides. */
		availableMb: number | null;
		onClose: () => void;
	};

	let { id, valkey, workspaceId, sizes, availableMb, onClose }: Props = $props();

	const resizeMutation = createUpdateValkeyMutation();

	// Starts from the saved size; the editor opens fresh each time.
	// svelte-ignore state_referenced_locally
	let size = $state(valkey.maxmemory_mb);
	let sizeError = $state<string | null>(null);

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
			onClose();
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
</script>

<InlineEditor
	{id}
	label="Ubah ukuran Valkey"
	onsubmit={resize}
	onCancel={onClose}
	pending={resizeMutation.isPending}
	submitDisabled={Boolean(resizeBlocked) || size === valkey.maxmemory_mb}
	submitLabel="Simpan ukuran"
	testid="valkey-resize"
	submitTestid="save-valkey-size"
>
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
</InlineEditor>
