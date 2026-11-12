<script lang="ts">
	import { tick, type Snippet } from 'svelte';
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
		/**
		 * Inputs of the action itself, such as a role or a limit, shown above the reason.
		 * `showErrors` turns true at the first confirm, so empty fields can say so from then on.
		 */
		fields?: Snippet<[{ showErrors: boolean }]>;
		/**
		 * Why the fields above cannot be sent yet, as a sentence that says what to do, or null.
		 * A confirm shows it beside the button and moves focus to the field marked invalid.
		 */
		fieldsProblem?: string | null;
		/** Replaces the fields and the reason when the action cannot happen from here at all. */
		unavailable?: Snippet;
		/** Why a reason is asked, shown above the field. */
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
		fieldsProblem = null,
		unavailable,
		reasonHint = 'Tulis singkat kenapa aksi ini dilakukan. Alasan ini masuk audit log bersama namamu, supaya admin lain bisa menelusurinya.',
		id = 'admin-reason'
	}: Props = $props();

	let reason = $state('');
	let submitting = $state(false);
	let attempted = $state(false);
	let textarea = $state<HTMLTextAreaElement | null>(null);
	let body = $state<HTMLDivElement | null>(null);

	// Every opening starts empty: a reason belongs to one action, never to the next one.
	$effect.pre(() => {
		if (open) {
			reason = '';
			submitting = false;
			attempted = false;
		}
	});

	// The content can turn unavailable after opening, once a list arrives empty; the textarea
	// that held focus is gone then, so focus moves to the way forward instead of the page.
	$effect(() => {
		if (!open || !unavailable) return;
		void tick().then(() => body?.querySelector<HTMLElement>('a[href]')?.focus());
	});

	const trimmed = $derived(reason.trim());
	const tooLong = $derived(reason.length > REASON_MAX);
	const reasonProblem = $derived(
		tooLong
			? `Alasan paling panjang ${REASON_MAX} karakter.`
			: trimmed
				? null
				: 'Alasan belum diisi. Tulis satu kalimat, misalnya permintaan siapa atau masalah apa.'
	);
	// Too long shows while typing, next to the counter; empty waits for the first confirm.
	const reasonError = $derived(
		(tooLong || attempted ? reasonProblem : null) ?? getFieldError(error, 'reason')
	);
	// The confirm button stays enabled (a disabled one cannot say why); this says why it stopped.
	const blockedText = $derived.by(() => {
		if (!attempted) return null;
		const sentences = [
			fieldsProblem,
			reasonProblem ? (tooLong ? 'Pendekkan alasannya.' : 'Isi alasan dulu.') : null
		].filter(Boolean);
		return sentences.length ? `Belum bisa dilanjutkan. ${sentences.join(' ')}` : null;
	});
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
		if (submitting || unavailable) return;
		attempted = true;
		if (fieldsProblem || reasonProblem) {
			await tick();
			const invalidField = fieldsProblem
				? body?.querySelector<HTMLElement>('[aria-invalid="true"]')
				: null;
			(invalidField ?? textarea)?.focus();
			return;
		}
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
	cancelLabel={unavailable ? 'Tutup' : 'Batal'}
	loading={submitting}
	hideConfirm={Boolean(unavailable)}
	confirmDescribedBy={blockedText ? `${id}-blocked` : undefined}
	initialFocus={() => textarea ?? body?.querySelector<HTMLElement>('a[href], button')}
	class="max-w-lg"
	titleClass="text-left"
	footerClass="flex-col-reverse sm:flex-row"
	onConfirm={confirm}
	{onCancel}
>
	<div bind:this={body} class="flex flex-col gap-4 text-left">
		<div class="rounded-control border border-border bg-background px-4 py-3">
			<p class="text-xs text-muted">Berlaku untuk</p>
			<p class="text-sm font-semibold wrap-anywhere text-foreground">{subject}</p>
		</div>
		<p class="text-sm text-foreground">{consequence}</p>

		{#if unavailable}
			{@render unavailable()}
		{:else}
			{#if fields}
				{@render fields({ showErrors: attempted })}
			{/if}

			<div class="space-y-1.5">
				<label for={`${id}-reason`} class="block text-sm font-medium text-foreground">
					Alasan <span class="font-normal text-foreground/70">(wajib)</span>
				</label>
				<p id={`${id}-reason-help`} class="text-xs text-foreground/70">{reasonHint}</p>
				<textarea
					id={`${id}-reason`}
					bind:this={textarea}
					bind:value={reason}
					rows="3"
					required
					disabled={submitting}
					aria-invalid={reasonError ? 'true' : undefined}
					aria-describedby={`${id}-reason-help ${id}-reason-status`}
					class="control-input resize-y"></textarea>
				<p id={`${id}-reason-status`} class="flex justify-between gap-3 text-xs">
					<span class="text-error-base">{reasonError ?? ''}</span>
					<span class="shrink-0 {tooLong ? 'text-error-base' : 'text-muted'}"
						>{reason.length}/{REASON_MAX}</span
					>
				</p>
			</div>

			{#if blockedText}
				<p
					id={`${id}-blocked`}
					class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-error"
					role="alert"
				>
					{blockedText}
				</p>
			{/if}
		{/if}

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
