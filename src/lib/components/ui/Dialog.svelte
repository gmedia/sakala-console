<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { fade, scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	type Variants = 'default' | 'destructive';
	type Emphasis = 'confirm' | 'cancel';

	type Props = {
		open: boolean;
		title: string;
		description?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel?: () => void;
		loading?: boolean;
		variant?: Variants;
		emphasis?: Emphasis;
		class?: string;
		children?: Snippet;
	};

	let {
		open = $bindable(),
		title,
		description,
		confirmLabel = 'Konfirmasi',
		cancelLabel = 'Batal',
		onConfirm,
		onCancel,
		loading = false,
		variant = 'default',
		emphasis = 'confirm',
		class: className,
		children
	}: Props = $props();

	const variants: Record<Variants, string> = {
		default: 'bg-primary hover:bg-primary/90',
		destructive: 'bg-error-base hover:bg-error-dark/90'
	};

	let dialogEl: HTMLDivElement | null = $state(null);
	let confirmButtonEl: HTMLButtonElement | null = $state(null);
	let cancelButtonEl: HTMLButtonElement | null = $state(null);

	function close() {
		if (loading) return;
		open = false;
		onCancel?.();
	}

	function handleConfirm() {
		if (loading) return;
		onConfirm();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}

		if (event.key === 'Tab' && dialogEl) {
			const focusable = dialogEl.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}
	}

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
			queueMicrotask(() => {
				const target = emphasis === 'cancel' ? cancelButtonEl : confirmButtonEl;
				target?.focus();
			});
		} else {
			document.body.style.overflow = '';
		}

		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-black/50"
			aria-label="Tutup dialog"
			tabindex="-1"
			onclick={close}
			transition:fade={{ duration: 150 }}
		></button>

		<div
			bind:this={dialogEl}
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby={description ? 'dialog-description' : undefined}
			class={cn(
				'relative w-full max-w-md rounded-xl border border-border-strong bg-surface p-6 shadow-lg',
				className
			)}
			transition:scale={{ duration: 150, start: 0.95 }}
		>
			<h2 id="dialog-title" class="text-lg font-montserrat-semibold text-foreground">
				{title}
			</h2>

			{#if description}
				<p id="dialog-description" class="mt-2 text-sm font-montserrat">
					{description}
				</p>
			{/if}

			{#if children}
				<div class="mt-4">
					{@render children()}
				</div>
			{/if}

			<div class="mt-6 flex justify-center w-full gap-2">
				<button
					type="button"
					onclick={close}
					disabled={loading}
					class={cn(
						'inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-montserrat-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
						emphasis === 'cancel'
							? cn('text-white', variants[variant])
							: 'border bg-surface text-foreground hover:bg-background-soft'
					)}
				>
					{cancelLabel}
				</button>

				<button
					bind:this={confirmButtonEl}
					type="button"
					onclick={handleConfirm}
					disabled={loading}
					class={cn(
						'inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-montserrat-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
						emphasis === 'confirm'
							? cn('text-white', variants[variant])
							: 'border bg-surface text-foreground hover:bg-background-soft'
					)}
				>
					{#if loading}
						<span
							class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
						></span>
					{/if}
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
