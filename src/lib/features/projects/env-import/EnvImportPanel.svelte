<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { parseEnvText, type SkippedEnvEntry } from './parse-env-text';
	import { planEnvImport, type EnvImportPlan, type ExistingKeyStrategy } from './plan-env-import';

	type Props = {
		/** Keys the project or the draft list already has. */
		existingKeys: readonly string[];
		initialText?: string;
		/** Says what happens to a pasted PORT here; the panel already says it is not added. */
		portNote?: (port: string) => string;
		confirmLabel: (count: number) => string;
		busy?: boolean;
		error?: string;
		/** Said beside the save button, which it describes; gets the plan and the id to render with. */
		confirmHint?: Snippet<[plan: EnvImportPlan, id: string]>;
		/** `port` is the pasted PORT, which is never part of the plan. */
		onApply: (plan: EnvImportPlan, port: string | null) => void;
		onCancel: () => void;
		/** 3 inside a wizard step, 2 directly under a page heading. */
		headingLevel?: 2 | 3;
	};

	let {
		existingKeys,
		initialText = '',
		portNote,
		confirmLabel,
		busy = false,
		error = '',
		confirmHint,
		onApply,
		onCancel,
		headingLevel = 3
	}: Props = $props();

	const id = $props.id();
	// svelte-ignore state_referenced_locally
	let text = $state(initialText);
	let strategy = $state<ExistingKeyStrategy>('skip');
	// Secret unless the user says otherwise, the same default as the API.
	let storeAllAsSecret = $state(true);
	let textarea = $state<HTMLTextAreaElement>();

	const parsed = $derived(parseEnvText(text));
	const plan = $derived(
		planEnvImport(parsed.entries, existingKeys, { strategy, storeAllAsSecret })
	);
	const existingInText = $derived(
		parsed.entries.filter((entry) => existingKeys.includes(entry.key)).map((entry) => entry.key)
	);
	const newCount = $derived(parsed.entries.length - existingInText.length);
	const changeCount = $derived(plan.toAdd.length + plan.toOverwrite.length);
	const keptSecret = $derived(
		storeAllAsSecret
			? []
			: [...plan.toAdd, ...plan.toOverwrite].filter((env) => env.looksSecret).map((env) => env.key)
	);
	const hasInput = $derived(text.trim() !== '');

	const SKIP_REASONS: Record<SkippedEnvEntry['reason'], string> = {
		empty_value: 'nilainya kosong',
		invalid_key: 'nama harus huruf besar, angka, atau underscore, misalnya APP_URL'
	};

	function rowStatus(key: string): string {
		if (!existingInText.includes(key)) return 'Baru';
		return strategy === 'overwrite' ? 'Ditimpa' : 'Dilewati, sudah ada';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && !busy) {
			event.preventDefault();
			onCancel();
		}
	}

	onMount(() => {
		textarea?.focus();
		if (initialText) textarea?.setSelectionRange(text.length, text.length);
	});
</script>

<!-- Esc is a shortcut; the Batal button stays the accessible path. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
	class="flex flex-col gap-3 rounded-control border border-border bg-surface p-3"
	aria-labelledby="{id}-title"
	onkeydown={handleKeydown}
	data-testid="env-import"
>
	<div>
		<svelte:element
			this={`h${headingLevel}`}
			id="{id}-title"
			class="font-sans text-sm font-semibold text-foreground"
		>
			Tempel isi file .env
		</svelte:element>
		<p class="text-xs text-foreground/70">
			Satu variabel per baris, NAMA=nilai. Komentar dan baris kosong diabaikan.
		</p>
	</div>

	<label for="{id}-text" class="sr-only">Isi file .env</label>
	<textarea
		id="{id}-text"
		bind:this={textarea}
		bind:value={text}
		rows="6"
		spellcheck="false"
		autocomplete="off"
		disabled={busy}
		placeholder="APP_ENV=production&#10;DATABASE_URL=postgres://..."
		class="control-input min-h-32 resize-y py-2 font-mono text-sm"></textarea>

	{#if hasInput}
		<p class="text-sm text-foreground" role="status" aria-live="polite">
			{#if parsed.entries.length === 0}
				Belum ada variabel yang terbaca. Pastikan setiap baris berbentuk NAMA=nilai.
			{:else}
				{parsed.entries.length} variabel terbaca: {newCount} baru{existingInText.length > 0
					? `, ${existingInText.length} sudah ada`
					: ''}.
			{/if}
		</p>

		{#if existingInText.length > 0}
			<fieldset class="flex flex-col gap-1">
				<legend class="mb-1 text-sm font-medium text-foreground">
					Untuk {existingInText.length} variabel yang sudah ada ({existingInText.join(', ')})
				</legend>
				<label class="flex min-h-6 items-center gap-2 text-sm">
					<input
						type="radio"
						name="{id}-strategy"
						value="skip"
						bind:group={strategy}
						class="size-4"
					/>
					Lewati, pertahankan nilai yang sekarang
				</label>
				<label class="flex min-h-6 items-center gap-2 text-sm">
					<input
						type="radio"
						name="{id}-strategy"
						value="overwrite"
						bind:group={strategy}
						class="size-4"
					/>
					Timpa dengan nilai yang ditempel
				</label>
			</fieldset>
		{/if}

		{#if parsed.entries.length > 0}
			<label class="flex min-h-6 items-start gap-2 text-sm">
				<input type="checkbox" bind:checked={storeAllAsSecret} class="mt-0.5 size-4 shrink-0" />
				Simpan semua sebagai secret, nilainya disembunyikan setelah disimpan
			</label>
			{#if keptSecret.length > 0}
				<p class="text-xs text-foreground/70">
					Tetap disimpan sebagai secret karena terlihat seperti kredensial: {keptSecret.join(', ')}.
					Ubah lewat tombol Ubah di tab Variabel kalau memang bukan secret.
				</p>
			{/if}

			<ul
				class="flex max-h-48 flex-col divide-y divide-border overflow-auto rounded-control border border-border"
				aria-label="Pratinjau variabel"
			>
				{#each parsed.entries as entry (entry.key)}
					<li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-3 py-1.5">
						<span class="min-w-0 font-mono text-sm wrap-anywhere">{entry.key}</span>
						<span class="text-xs text-foreground/70">{rowStatus(entry.key)}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if parsed.port}
			<p class="text-xs text-foreground/70">
				PORT tidak ditambahkan, karena Sakala mengisinya sendiri dari Port proyek.
				{portNote?.(parsed.port) ?? ''}
			</p>
		{/if}
		{#if parsed.skipped.length > 0}
			<p class="text-xs text-foreground/70">
				Dilewati: {parsed.skipped
					.map((entry) => `${entry.key} (${SKIP_REASONS[entry.reason]})`)
					.join('; ')}.
			</p>
		{/if}
		{#if parsed.unreadableLines > 0}
			<p class="text-xs text-foreground/70">
				{parsed.unreadableLines} baris tidak terbaca karena bukan berbentuk NAMA=nilai.
			</p>
		{/if}
	{/if}

	{#if error}
		<p role="alert" class="text-sm text-error-dark">{error}</p>
	{/if}

	{#if confirmHint && changeCount > 0}
		{@render confirmHint(plan, `${id}-confirm-hint`)}
	{/if}

	<div class="flex flex-wrap justify-end gap-2">
		<Button variant="ghost" onclick={onCancel} disabled={busy}>Batal</Button>
		<Button
			onclick={() => onApply(plan, parsed.port)}
			disabled={busy || changeCount === 0}
			aria-busy={busy}
			aria-describedby={confirmHint && changeCount > 0 ? `${id}-confirm-hint` : undefined}
		>
			{confirmLabel(changeCount)}
		</Button>
	</div>
</section>
