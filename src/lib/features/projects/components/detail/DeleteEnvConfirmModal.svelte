<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import Dialog from '$lib/components/ui/Dialog.svelte';

	type Props = {
		open: boolean;
		envKey: string;
		isLoading?: boolean;
		error?: string;
		onConfirm: () => void;
		onClose: () => void;
	};

	let { open = false, envKey, isLoading = false, error = '', onConfirm, onClose }: Props = $props();
</script>

{#snippet icon()}
	<div
		class="mb-4 flex size-12 shrink-0 items-center justify-center rounded-full bg-error-50 text-error"
	>
		<Trash size={24} aria-hidden="true" />
	</div>
{/snippet}

{#snippet description()}
	Perubahan ini berlaku setelah redeploy berikutnya. Aplikasi yang sedang live sekarang
	<strong class="font-semibold text-foreground">belum</strong> terpengaruh sampai kamu redeploy.
{/snippet}

<Dialog
	{open}
	{icon}
	{description}
	title={`Hapus variabel ${envKey}?`}
	titleClass="wrap-anywhere"
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg"
	confirmLabel="Hapus variabel"
	variant="destructive"
	initialFocus="cancel"
	loading={isLoading}
	{onConfirm}
	onCancel={onClose}
>
	{#if error}
		<p role="alert" class="text-sm text-error-dark">{error}</p>
	{/if}
</Dialog>
