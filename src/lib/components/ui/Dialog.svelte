<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import type { Snippet } from 'svelte';

	type Variants = 'default' | 'destructive';
	type Emphasis = 'confirm' | 'cancel';

	type Props = {
		open: boolean;
		title: string | Snippet;
		description?: string | Snippet;
		/** Shown above the title, for example the trash icon on delete confirmations. */
		icon?: Snippet;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel?: () => void;
		loading?: boolean;
		variant?: Variants;
		emphasis?: Emphasis;
		confirmDisabled?: boolean;
		/** Where focus lands on open. Defaults to the emphasised button, but never a destructive confirm. */
		initialFocus?: Emphasis | (() => HTMLElement | null | undefined);
		/** Where focus goes on close, for a dialog opened from something that is gone by then. */
		returnFocus?: () => HTMLElement | null | undefined;
		class?: string;
		titleClass?: string;
		descriptionClass?: string;
		footerClass?: string;
		children?: Snippet;
	};

	let {
		open = $bindable(),
		title,
		description,
		icon,
		confirmLabel = 'Konfirmasi',
		cancelLabel = 'Batal',
		onConfirm,
		onCancel,
		loading = false,
		variant = 'default',
		emphasis = 'confirm',
		confirmDisabled = false,
		initialFocus,
		returnFocus,
		class: className,
		titleClass,
		descriptionClass,
		footerClass,
		children
	}: Props = $props();

	const variants: Record<Variants, string> = {
		default: 'bg-primary hover:bg-primary/90',
		destructive: 'bg-error hover:bg-error-dark'
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
		if (loading || confirmDisabled) return;
		onConfirm();
	}

	function handleCloseAutoFocus(event: Event) {
		const target = returnFocus?.();
		if (!target) return;
		event.preventDefault();
		target.focus();
	}

	function handleAutoFocus(event: Event) {
		event.preventDefault();
		if (typeof initialFocus === 'function') {
			initialFocus()?.focus();
			return;
		}
		const fallback = variant === 'destructive' ? 'cancel' : emphasis;
		const target = (initialFocus ?? fallback) === 'cancel' ? cancelButtonEl : confirmButtonEl;
		target?.focus();
	}
</script>

<!-- Function binding keeps this controlled: bits-ui must not close itself while `loading` refuses. -->
<DialogPrimitive.Root bind:open={() => open, handleOpenChange}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-black/50" />
		<DialogPrimitive.Content
			onOpenAutoFocus={handleAutoFocus}
			onCloseAutoFocus={handleCloseAutoFocus}
			class={cn(
				'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
				'max-h-[calc(100dvh-2rem)] overflow-y-auto',
				'rounded-xl border border-border bg-surface p-6 shadow-lg',
				className
			)}
		>
			{#if icon}
				{@render icon()}
			{/if}

			<DialogPrimitive.Title
				class={cn('text-lg font-montserrat-semibold wrap-anywhere text-foreground', titleClass)}
			>
				{#if typeof title === 'string'}
					{title}
				{:else}
					{@render title()}
				{/if}
			</DialogPrimitive.Title>

			{#if description}
				<DialogPrimitive.Description class={cn('mt-2 text-sm font-montserrat', descriptionClass)}>
					{#if typeof description === 'string'}
						{description}
					{:else}
						{@render description()}
					{/if}
				</DialogPrimitive.Description>
			{/if}

			{#if children}
				<div class="mt-4">
					{@render children()}
				</div>
			{/if}

			<div class={cn('mt-6 flex justify-center w-full gap-2', footerClass)}>
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
					disabled={loading || confirmDisabled}
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
