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
			class="relative w-full max-w-lg 2xl:max-w-[534px] max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-2xl p-6 sm:p-8 flex flex-col justify-between animate-in zoom-in-95 duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-env-title"
			aria-describedby="delete-env-desc"
		>
			<div class="flex flex-col">
				<div
					class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-error-50 text-error flex items-center justify-center mb-6 shrink-0"
				>
					<Trash size={32} weight="regular" />
				</div>

				<h2
					id="delete-env-title"
					class="font-jetbrains-mono-semibold font-bold text-xl sm:text-2xl 2xl:text-[28px] text-foreground leading-tight mb-3 break-words"
				>
					Hapus Variabel {envKey}?
				</h2>

				<p
					id="delete-env-desc"
					class="font-montserrat text-sm sm:text-base 2xl:text-[20px] text-muted-2 leading-snug mb-6 sm:mb-8"
				>
					Perubahan ini berlaku setelah redeploy berikutnya. Aplikasi yang sedang live sekarang
					<strong class="font-bold text-foreground">belum</strong> terpengaruh sampai kamu redeploy.
				</p>
			</div>

			<div class="flex flex-col-reverse sm:flex-row items-center gap-3 w-full">
				<button
					type="button"
					onclick={onClose}
					disabled={isLoading}
					class="w-full sm:w-36 2xl:w-42.5 h-12 rounded-lg border border-black bg-surface text-foreground font-montserrat-semibold text-sm sm:text-base flex items-center justify-center hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-50"
				>
					Batal
				</button>

				<button
					type="button"
					onclick={onConfirm}
					disabled={isLoading}
					class="w-full sm:flex-1 2xl:w-[288px] h-12 rounded-lg border-none bg-error text-white font-montserrat-semibold text-sm sm:text-base flex items-center justify-center gap-2 hover:bg-error-dark transition-colors cursor-pointer disabled:opacity-50"
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
