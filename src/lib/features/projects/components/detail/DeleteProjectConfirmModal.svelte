<script lang="ts">
	import { Trash, CircleNotch } from 'phosphor-svelte';

	type Props = {
		open: boolean;
		projectName: string;
		defaultDomain?: string;
		deploymentCount?: number;
		isLoading?: boolean;
		onConfirm: () => void;
		onClose: () => void;
	};

	let {
		open = false,
		projectName,
		defaultDomain,
		deploymentCount = 0,
		isLoading = false,
		onConfirm,
		onClose
	}: Props = $props();

	let confirmInput = $state('');

	let canDelete = $derived(confirmInput.trim().toLowerCase() === projectName.trim().toLowerCase());

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape' && !isLoading) {
			handleClose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget && !isLoading) {
			handleClose();
		}
	}

	function handleClose() {
		confirmInput = '';
		onClose();
	}

	function handleConfirm() {
		if (!canDelete || isLoading) return;
		onConfirm();
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
			class="relative w-full max-w-lg 2xl:max-w-[570px] max-h-[90vh] overflow-y-auto rounded-2xl bg-surface border border-border shadow-2xl p-6 sm:p-8 flex flex-col justify-between animate-in zoom-in-95 duration-150"
			role="dialog"
			aria-modal="true"
			aria-labelledby="delete-project-title"
			aria-describedby="delete-project-desc"
		>
			<div class="flex flex-col">
				<div
					class="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-error-50 text-error flex items-center justify-center mb-6 shrink-0"
				>
					<Trash size={32} weight="regular" />
				</div>

				<h2
					id="delete-project-title"
					class="font-montserrat-semibold font-bold text-xl sm:text-2xl 2xl:text-[28px] text-foreground leading-tight mb-3 break-words"
				>
					Hapus proyek <span class="font-jetbrains-mono-semibold font-bold">{projectName}</span>?
				</h2>

				<p
					id="delete-project-desc"
					class="font-montserrat text-sm sm:text-base 2xl:text-[20px] text-muted-2 leading-snug mb-6"
				>
					Tindakan ini <strong class="font-bold text-foreground">permanen</strong> dan tidak bisa dibatalkan.
					Semua data berikut akan ikut terhapus:
				</p>

				<ul
					class="list-disc list-inside space-y-1 font-montserrat text-sm sm:text-base 2xl:text-[20px] text-muted-2 leading-snug mb-6"
				>
					<li>
						Semua riwayat deployment {deploymentCount > 0 ? `(${deploymentCount} deployment)` : ''}
					</li>
					<li>
						Domain publik {defaultDomain || 'yang terhubung'}
					</li>
					<li>Semua environment variable</li>
				</ul>

				<div class="flex flex-col mb-8">
					<label
						for="confirmInput"
						class="font-montserrat text-sm sm:text-base 2xl:text-[20px] text-foreground leading-snug mb-2"
					>
						Ketik <strong
							class="font-jetbrains-mono-semibold font-bold text-sm sm:text-base 2xl:text-[20px] text-foreground"
							>{projectName}</strong
						> untuk konfirmasi
					</label>
					<input
						type="text"
						id="confirmInput"
						bind:value={confirmInput}
						placeholder="contoh: nama-project"
						disabled={isLoading}
						class="w-full h-12 rounded-lg border border-border bg-background px-4 font-jetbrains-mono-regular text-sm sm:text-base text-foreground outline-none focus:border-primary transition-colors disabled:opacity-50"
					/>
				</div>
			</div>

			<div class="flex flex-col-reverse sm:flex-row items-center gap-3 w-full">
				<button
					type="button"
					onclick={handleClose}
					disabled={isLoading}
					class="w-full sm:w-36 2xl:w-42.5 h-12 rounded-lg border border-black bg-surface text-foreground font-montserrat-semibold text-sm sm:text-base flex items-center justify-center hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-50"
				>
					Batal
				</button>

				<button
					type="button"
					onclick={handleConfirm}
					disabled={!canDelete || isLoading}
					class="w-full sm:flex-1 2xl:w-[288px] h-12 rounded-lg border-none font-montserrat-semibold text-sm sm:text-base flex items-center justify-center gap-2 transition-colors {canDelete &&
					!isLoading
						? 'bg-error text-white hover:bg-error-dark cursor-pointer'
						: 'bg-black/5 text-muted cursor-not-allowed'}"
				>
					{#if isLoading}
						<CircleNotch size={20} weight="bold" class="animate-spin text-white" />
					{/if}
					<span>Hapus proyek ini</span>
				</button>
			</div>
		</div>
	</div>
{/if}
