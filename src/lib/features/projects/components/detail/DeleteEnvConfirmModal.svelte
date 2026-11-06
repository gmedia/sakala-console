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
		class="mb-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-error-50 text-error sm:size-16"
	>
		<Trash size={32} weight="regular" />
	</div>
{/snippet}

{#snippet description()}
	Perubahan ini berlaku setelah redeploy berikutnya. Aplikasi yang sedang live sekarang
	<strong class="font-bold text-foreground">belum</strong> terpengaruh sampai kamu redeploy.
{/snippet}

<Dialog
	{open}
	{icon}
	{description}
	title={`Hapus Variabel ${envKey}?`}
	titleClass="font-jetbrains-mono-semibold font-bold text-xl leading-tight sm:text-2xl 2xl:text-[28px]"
	descriptionClass="mt-3 text-sm leading-snug text-foreground/70 sm:text-base 2xl:text-[20px]"
	footerClass="flex-col-reverse sm:flex-row"
	class="max-w-lg rounded-2xl p-6 sm:p-8 2xl:max-w-133.5"
	confirmLabel="Hapus Variabel"
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
