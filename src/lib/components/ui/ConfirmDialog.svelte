<script lang="ts">
	import { WarningCircle, Info, CircleNotch, X } from 'phosphor-svelte';

	type Props = {
		open: boolean;
		title: string;
		description: string;
		confirmText?: string;
		cancelText?: string;
		tone?: 'danger' | 'primary';
		isLoading?: boolean;
		onConfirm: () => void;
		onClose: () => void;
	};

	let {
		open = false,
		title,
		description,
		confirmText = 'Konfirmasi',
		cancelText = 'Batal',
		tone = 'danger',
		isLoading = false,
		onConfirm,
		onClose
	}: Props = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape' && !isLoading) {
			onClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && !isLoading) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			class="relative w-full max-w-md rounded-lg bg-surface border border-border p-6 shadow-xl flex flex-col gap-4 animate-in zoom-in-95 duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby="dialog-desc"
		>
			<button
				type="button"
				class="absolute top-4 right-4 text-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
				onclick={onClose}
				disabled={isLoading}
				aria-label="Tutup"
			>
				<X size={20} weight="bold" />
			</button>

			<div class="flex items-start gap-3.5">
				<div
					class="p-2.5 rounded-lg shrink-0 {tone === 'danger'
						? 'bg-error-50 text-error'
						: 'bg-primary-50 text-primary'}"
				>
					{#if tone === 'danger'}
						<WarningCircle size={24} weight="fill" />
					{:else}
						<Info size={24} weight="fill" />
					{/if}
				</div>

				<div class="flex flex-col gap-1 pr-6">
					<h3
						id="dialog-title"
						class="font-montserrat-semibold text-base text-foreground leading-snug"
					>
						{title}
					</h3>
					<p id="dialog-desc" class="font-montserrat text-sm text-muted leading-relaxed">
						{description}
					</p>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-border/60">
				<button
					type="button"
					onclick={onClose}
					disabled={isLoading}
					class="px-4 h-9 rounded-lg border border-border bg-surface text-foreground font-montserrat-medium text-sm hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-50"
				>
					{cancelText}
				</button>

				<button
					type="button"
					onclick={onConfirm}
					disabled={isLoading}
					class="px-4 h-9 rounded-lg flex items-center justify-center gap-2 font-montserrat-semibold text-sm text-white transition-colors cursor-pointer disabled:opacity-50 {tone ===
					'danger'
						? 'bg-error hover:bg-error-dark'
						: 'bg-primary hover:bg-primary/90'}"
				>
					{#if isLoading}
						<CircleNotch size={16} weight="bold" class="animate-spin" />
					{/if}
					<span>{confirmText}</span>
				</button>
			</div>
		</div>
	</div>
{/if}
