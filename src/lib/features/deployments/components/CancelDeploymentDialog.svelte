<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type Props = {
		open: boolean;
		sequence: number;
		isLoading?: boolean;
		error?: string;
		onConfirm: () => void;
		onClose: () => void;
	};

	let {
		open = false,
		sequence,
		isLoading = false,
		error = '',
		onConfirm,
		onClose
	}: Props = $props();
</script>

<Dialog
	{open}
	title={`Batalkan Deployment #${sequence}?`}
	description="Prosesnya dihentikan dan tidak bisa dilanjutkan. Kalau masih ingin men-deploy, jalankan Redeploy setelahnya."
	confirmLabel="Ya, batalkan"
	cancelLabel="Tidak jadi"
	variant="destructive"
	initialFocus="cancel"
	loading={isLoading}
	{onConfirm}
	onCancel={onClose}
>
	{#if error}
		<p role="alert" class="font-montserrat text-sm text-error-dark">{error}</p>
	{/if}
</Dialog>
