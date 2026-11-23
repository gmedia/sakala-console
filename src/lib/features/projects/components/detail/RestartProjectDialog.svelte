<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { RESTART_COPY } from '../../restart';

	type Props = {
		open: boolean;
		/** The app crash-loops, so a restart may not be enough, and the dialog says so. */
		crashed?: boolean;
		isLoading?: boolean;
		error?: string;
		onConfirm: () => void;
		onClose: () => void;
	};

	let {
		open = false,
		crashed = false,
		isLoading = false,
		error = '',
		onConfirm,
		onClose
	}: Props = $props();
</script>

<Dialog
	{open}
	title={RESTART_COPY.title}
	description={RESTART_COPY.description}
	confirmLabel={RESTART_COPY.confirm}
	cancelLabel={RESTART_COPY.cancel}
	loading={isLoading}
	{onConfirm}
	onCancel={onClose}
>
	{#if crashed || error}
		<div class="flex flex-col gap-3" data-testid="restart-dialog-body">
			{#if crashed}
				<p class="text-sm text-foreground">{RESTART_COPY.crashedNote}</p>
			{/if}
			{#if error}
				<p role="alert" class="text-sm text-error-dark">{error}</p>
			{/if}
		</div>
	{/if}
</Dialog>
