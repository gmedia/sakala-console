<script lang="ts">
	import { Trash, CircleNotch } from 'phosphor-svelte';

	type Props = {
		open: boolean;
		envKey: string;
		isLoading?: boolean;
		onConfirm: () => void;
		onClose: () => void;
	};

	let { open = false, envKey, isLoading = false, onConfirm, onClose }: Props = $props();

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
			class="relative w-133.5 max-w-[calc(100vw-32px)] min-h-88.25 rounded-2xl bg-surface border border-border shadow-2xl flex flex-col justify-between animate-in zoom-in-95 duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-env-title"
			aria-describedby="delete-env-desc"
		>
			<div class="pt-8 px-8 flex flex-col">
				<div
					class="w-16 h-16 rounded-full bg-error-50 text-error flex items-center justify-center mb-6 shrink-0"
				>
					<Trash size={32} weight="regular" />
				</div>

				<h2
					id="delete-env-title"
					class="font-jetbrains-mono-semibold font-bold text-[28px] text-foreground leading-tight mb-3 break-all"
				>
					Hapus Variabel {envKey}?
				</h2>

				<p id="delete-env-desc" class="font-montserrat text-[20px] text-muted-2 leading-relaxed">
					Perubahan ini berlaku setelah redeploy berikutnya. Aplikasi yang sedang live sekarang
					<strong class="font-bold text-foreground">belum</strong> terpengaruh sampai kamu redeploy.
				</p>
			</div>

			<div class="px-8 pb-8 pt-8 flex items-center gap-3">
				<button
					type="button"
					onclick={onClose}
					disabled={isLoading}
					class="w-42.5 h-12 rounded-lg border border-black bg-surface text-foreground font-montserrat-semibold text-base flex items-center justify-center hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-50"
				>
					Batal
				</button>

				<button
					type="button"
					onclick={onConfirm}
					disabled={isLoading}
					class="w-[288px] h-12 rounded-lg border-none bg-error text-white font-montserrat-semibold text-base flex items-center justify-center gap-2 hover:bg-error-dark transition-colors cursor-pointer disabled:opacity-50"
				>
					{#if isLoading}
						<CircleNotch size={20} weight="bold" class="animate-spin text-white" />
					{/if}
					<span>Hapus Variabel</span>
				</button>
			</div>
		</div>
	</div>
{/if}
