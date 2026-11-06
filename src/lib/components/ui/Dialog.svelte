<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import Button from './Button.svelte';
	import { buttonClasses } from './button-classes';
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

	const emphasised = $derived(variant === 'destructive' ? 'danger' : 'primary');

	let confirmButtonEl: HTMLElement | null = $state(null);
	let cancelButtonEl: HTMLElement | null = $state(null);

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
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-scrim/50" />
		<DialogPrimitive.Content
			onOpenAutoFocus={handleAutoFocus}
			onCloseAutoFocus={handleCloseAutoFocus}
			class={cn(
				'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
				'max-h-[calc(100dvh-2rem)] overflow-y-auto',
				'rounded-overlay border border-border bg-surface p-6 shadow-overlay',
				className
			)}
		>
			{#if icon}
				{@render icon()}
			{/if}

			<DialogPrimitive.Title
				class={cn('font-display text-xl font-semibold wrap-anywhere text-foreground', titleClass)}
			>
				{#if typeof title === 'string'}
					{title}
				{:else}
					{@render title()}
				{/if}
			</DialogPrimitive.Title>

			{#if description}
				<DialogPrimitive.Description class={cn('mt-2 text-sm', descriptionClass)}>
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
					class={buttonClasses(emphasis === 'cancel' ? emphasised : 'secondary', 'md', 'w-full')}
				>
					{cancelLabel}
				</DialogPrimitive.Close>

				<Button
					bind:ref={confirmButtonEl}
					variant={emphasis === 'confirm' ? emphasised : 'secondary'}
					class="w-full"
					onclick={handleConfirm}
					disabled={loading || confirmDisabled}
				>
					{#if loading}
						<span
							class="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current"
						></span>
					{/if}
					{confirmLabel}
				</Button>
			</div>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
