<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
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

	let confirmButtonEl: HTMLButtonElement | null = $state(null);
	let cancelButtonEl: HTMLButtonElement | null = $state(null);

	function handleOpenChange(next: boolean) {
		if (loading && !next) return;
		open = next;
		if (!next) {
			onCancel?.();
		}
	}

	function handleConfirm() {
		if (loading) return;
		onConfirm();
	}

	function handleAutoFocus(event: Event) {
		event.preventDefault();
		const target = emphasis === 'cancel' ? cancelButtonEl : confirmButtonEl;
		target?.focus();
	}
</script>

<DialogPrimitive.Root {open} onOpenChange={handleOpenChange}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<DialogPrimitive.Content
			onOpenAutoFocus={handleAutoFocus}
			class={cn(
				'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
				'rounded-xl border border-border-strong bg-surface p-6 shadow-lg',
				className
			)}
		>
			<DialogPrimitive.Title class="text-lg font-montserrat-semibold text-foreground">
				{title}
			</DialogPrimitive.Title>

			{#if description}
				<DialogPrimitive.Description class="mt-2 text-sm font-montserrat">
					{description}
				</DialogPrimitive.Description>
			{/if}

			{#if children}
				<div class="mt-4">
					{@render children()}
				</div>
			{/if}

			<div class="mt-6 flex justify-center w-full gap-2">
				<DialogPrimitive.Close
					bind:ref={cancelButtonEl}
					disabled={loading}
					class={cn(
						'inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-montserrat-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
						emphasis === 'cancel'
							? cn('text-white', variants[variant])
							: 'border bg-surface text-foreground hover:bg-background-soft'
					)}
				>
					{cancelLabel}
				</DialogPrimitive.Close>

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
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
