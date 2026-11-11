<script lang="ts">
	import type { Snippet } from 'svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';

	const REASON_MAX = 500;

	type Props = {
		open: boolean;
		title: string;
		/** The thing this acts on, named in the dialog so nobody acts on the wrong row. */
		subject: string;
		/** What happens, in words, before anyone confirms. */
		consequence: string;
		confirmLabel: string;
		variant?: 'default' | 'destructive';
		/** Resolves when the request is over, either way. Errors arrive through `error`. */
		onConfirm: (reason: string) => Promise<unknown>;
		onCancel?: () => void;
		error?: unknown;
		/** Replaces the generic text for `error`, when the action knows better words for it. */
		errorText?: string | null;
		/** Inputs of the action itself, such as a role or a limit, shown above the reason. */
		fields?: Snippet;
		/** The fields above are not valid yet. */
		fieldsInvalid?: boolean;
		reasonHint?: string;
		id?: string;
	};

	let {
		open = $bindable(),
		title,
		subject,
		consequence,
		confirmLabel,
		variant = 'default',
		onConfirm,
		onCancel,
		error = null,
		errorText = null,
		fields,
		fieldsInvalid = false,
		reasonHint = 'Wajib. Tercatat di audit log bersama namamu.',
		id = 'admin-reason'
	}: Props = $props();

	let reason = $state('');
	let submitting = $state(false);
	let textarea = $state<HTMLTextAreaElement | null>(null);

	// Every opening starts empty: a reason belongs to one action, never to the next one.
	$effect.pre(() => {
		if (open) {
			reason = '';
			submitting = false;
		}
	});

	const trimmed = $derived(reason.trim());
	const tooLong = $derived(reason.length > REASON_MAX);
	const reasonError = $derived(
		tooLong ? `Alasan paling panjang ${REASON_MAX} karakter.` : getFieldError(error, 'reason')
	);
	const generalError = $derived(
		errorText ??
			(error &&
			!(error instanceof ApiError && error.isValidationError && getFieldError(error, 'reason'))
				? getErrorMessage(error, 'Permintaan gagal. Coba lagi.')
				: null)
	);

	async function confirm() {
		// The flag, not the button state, stops a second click: the button only disables after
		// the next render, and a fast double click lands before that.
		if (submitting || !trimmed || tooLong || fieldsInvalid) return;
		submitting = true;
		try {
			await onConfirm(trimmed);
		} finally {
			submitting = false;
		}
	}
</script>

<Dialog
	bind:open
	{title}
	{variant}
	{confirmLabel}
	cancelLabel="Batal"
	loading={submitting}
	confirmDisabled={!trimmed || tooLong || fieldsInvalid}
	initialFocus={() => textarea}
	class="max-w-lg"
	titleClass="text-left"
	footerClass="flex-col-reverse sm:flex-row"
	onConfirm={confirm}
	{onCancel}
>
	<div class="flex flex-col gap-4 text-left">
		<div class="rounded-control border border-border bg-background px-4 py-3">
			<p class="text-xs text-muted">Berlaku untuk</p>
			<p class="text-sm font-semibold wrap-anywhere text-foreground">{subject}</p>
		</div>
		<p class="text-sm text-foreground">{consequence}</p>

		{#if fields}
			{@render fields()}
		{/if}

		<div class="space-y-1.5">
			<label for={`${id}-reason`} class="block text-sm font-medium text-foreground">Alasan</label>
			<textarea
				id={`${id}-reason`}
				bind:this={textarea}
				bind:value={reason}
				rows="3"
				required
				disabled={submitting}
				aria-invalid={reasonError ? 'true' : undefined}
				aria-describedby={`${id}-reason-hint`}
				class="control-input resize-y"></textarea>
			<p id={`${id}-reason-hint`} class="flex justify-between gap-3 text-xs">
				<span class={reasonError ? 'text-error-base' : 'text-foreground/70'}>
					{reasonError ?? reasonHint}
				</span>
				<span class={tooLong ? 'text-error-base' : 'text-muted'}>{reason.length}/{REASON_MAX}</span>
			</p>
		</div>

		{#if generalError}
			<p
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-error"
				role="alert"
			>
				{generalError}
			</p>
		{/if}
	</div>
</Dialog>
