<script lang="ts">
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import { SvelteSet } from 'svelte/reactivity';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		rowsInGroup,
		SUGGESTION_GROUPS,
		type EnvSuggestion,
		type EnvSuggestionGroup
	} from './classify-env-example';
	import {
		alreadySetText,
		exampleNoteText,
		needsInputHint,
		platformText,
		SUGGESTION_COPY,
		SUGGESTION_GROUP_DESCRIPTIONS,
		SUGGESTION_GROUP_LABELS
	} from './presentation';
	import type { DraftEntry, SuggestionDraft } from './suggestion-draft';
	import SuggestionGroup from './SuggestionGroup.svelte';

	/**
	 * The variables a `.env.example` suggests, grouped by what the user has to do: only "Perlu kamu
	 * isi" is open, because only it needs the user; the rest are closed groups with their counts and
	 * names (Hick's Law: one thing to act on; Tesler's Law: Sakala carries the rest). The same list
	 * serves the wizard and the Variabel tab, so a group means the same thing in both.
	 */
	type Props = {
		rows: readonly EnvSuggestion[];
		draft: SuggestionDraft;
		/** Keys from the file the project already has, left as they are. */
		alreadySet?: readonly string[];
		onEdit: (key: string, change: Partial<Pick<DraftEntry, 'included' | 'value'>>) => void;
		disabled?: boolean;
		/** What happens to a key the project has, on the Variabel tab ("Dilewati, sudah ada"). */
		statusOf?: (key: string) => string | null;
		truncated?: boolean;
		headingLevel?: 3 | 4;
	};

	let {
		rows,
		draft,
		alreadySet = [],
		onEdit,
		disabled = false,
		statusOf,
		truncated = false,
		headingLevel = 4
	}: Props = $props();

	const id = $props.id();
	const revealed = new SvelteSet<string>();

	const needsInput = $derived(rowsInGroup(rows, SUGGESTION_GROUPS.needsInput));
	const generated = $derived(rowsInGroup(rows, SUGGESTION_GROUPS.generated));
	const examples = $derived(rowsInGroup(rows, SUGGESTION_GROUPS.example));
	const platform = $derived(rowsInGroup(rows, SUGGESTION_GROUPS.platform));
	const alreadySetLine = $derived(alreadySetText(alreadySet));

	/** A key inside an id: names are `[A-Z0-9_]`, which ids accept as they are. */
	const fieldId = (key: string) => `${id}-${key}`;

	function toggleReveal(key: string) {
		if (revealed.has(key)) revealed.delete(key);
		else revealed.add(key);
	}

	function groupKeys(group: readonly { key: string }[]) {
		return group.map((row) => row.key);
	}

	function label(group: EnvSuggestionGroup) {
		return SUGGESTION_GROUP_LABELS[group];
	}
</script>

{#snippet includeBox(key: string)}
	<label class="flex min-h-6 min-w-0 items-center gap-2">
		<input
			type="checkbox"
			class="size-4 shrink-0"
			checked={draft[key]?.included ?? false}
			{disabled}
			aria-label={SUGGESTION_COPY.include(key)}
			onchange={(event) => onEdit(key, { included: event.currentTarget.checked })}
		/>
		<span class="min-w-0 font-mono text-sm font-medium wrap-anywhere">{key}</span>
	</label>
	{#if statusOf?.(key)}
		<span class="text-xs text-foreground/70">{statusOf(key)}</span>
	{/if}
{/snippet}

{#snippet revealButton(key: string)}
	<Button
		variant="ghost"
		size="icon"
		{disabled}
		aria-pressed={revealed.has(key)}
		aria-label={revealed.has(key) ? SUGGESTION_COPY.hide(key) : SUGGESTION_COPY.show(key)}
		title={revealed.has(key) ? 'Sembunyikan nilai' : 'Tampilkan nilai'}
		onclick={() => toggleReveal(key)}
	>
		{#if revealed.has(key)}
			<EyeSlash size={20} aria-hidden="true" />
		{:else}
			<Eye size={20} aria-hidden="true" />
		{/if}
	</Button>
{/snippet}

<div class="flex flex-col gap-3" data-testid="env-suggestions">
	{#if needsInput.length > 0}
		<section class="flex flex-col gap-2" aria-labelledby="{id}-needs-input">
			<div>
				<svelte:element
					this={`h${headingLevel}`}
					id="{id}-needs-input"
					class="font-sans text-sm font-semibold text-foreground"
				>
					{label(SUGGESTION_GROUPS.needsInput)} ({needsInput.length})
				</svelte:element>
				<p class="text-xs text-foreground/70">
					{SUGGESTION_GROUP_DESCRIPTIONS[SUGGESTION_GROUPS.needsInput]}
				</p>
			</div>
			<ul class="flex flex-col gap-3">
				{#each needsInput as row (row.key)}
					<li class="flex flex-col gap-1">
						<div class="flex flex-wrap items-center justify-between gap-x-3">
							{@render includeBox(row.key)}
						</div>
						<label for={fieldId(row.key)} class="sr-only"
							>{SUGGESTION_COPY.valueLabel(row.key)}</label
						>
						<div class="flex items-center gap-1">
							<input
								id={fieldId(row.key)}
								type={revealed.has(row.key) ? 'text' : 'password'}
								class="control-input min-w-0 flex-1 font-mono text-sm"
								value={draft[row.key]?.value ?? ''}
								autocomplete="off"
								spellcheck="false"
								{disabled}
								aria-describedby="{fieldId(row.key)}-hint"
								oninput={(event) => onEdit(row.key, { value: event.currentTarget.value })}
							/>
							{@render revealButton(row.key)}
						</div>
						<p id="{fieldId(row.key)}-hint" class="text-xs text-foreground/70">
							{needsInputHint(row)}
						</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if generated.length > 0}
		<SuggestionGroup
			title={label(SUGGESTION_GROUPS.generated)}
			count={generated.length}
			keys={groupKeys(generated)}
			description={SUGGESTION_GROUP_DESCRIPTIONS[SUGGESTION_GROUPS.generated]}
			{headingLevel}
		>
			<ul class="flex flex-col divide-y divide-border">
				{#each generated as row (row.key)}
					<li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1.5">
						{@render includeBox(row.key)}
						<span class="flex min-w-0 items-center gap-1">
							{#if revealed.has(row.key)}
								<span
									class="min-w-0 font-mono text-xs wrap-anywhere text-foreground select-all"
									data-testid="generated-value">{draft[row.key]?.value ?? ''}</span
								>
							{:else}
								<span
									class="font-mono text-sm text-foreground/70"
									role="img"
									aria-label="Nilai disembunyikan">••••••••</span
								>
							{/if}
							{@render revealButton(row.key)}
						</span>
					</li>
				{/each}
			</ul>
		</SuggestionGroup>
	{/if}

	{#if examples.length > 0}
		<SuggestionGroup
			title={label(SUGGESTION_GROUPS.example)}
			count={examples.length}
			keys={groupKeys(examples)}
			description={SUGGESTION_GROUP_DESCRIPTIONS[SUGGESTION_GROUPS.example]}
			{headingLevel}
		>
			<ul class="flex flex-col gap-3">
				{#each examples as row (row.key)}
					<li class="flex flex-col gap-1">
						<div class="flex flex-wrap items-center justify-between gap-x-3">
							{@render includeBox(row.key)}
						</div>
						<label for={fieldId(row.key)} class="sr-only"
							>{SUGGESTION_COPY.valueLabel(row.key)}</label
						>
						<input
							id={fieldId(row.key)}
							type="text"
							class="control-input font-mono text-sm"
							value={draft[row.key]?.value ?? ''}
							autocomplete="off"
							spellcheck="false"
							{disabled}
							aria-describedby={row.note ? `${fieldId(row.key)}-note` : undefined}
							oninput={(event) => onEdit(row.key, { value: event.currentTarget.value })}
						/>
						{#if row.note}
							<p id="{fieldId(row.key)}-note" class="text-xs text-foreground/70">
								{exampleNoteText(row.note)}
							</p>
						{/if}
					</li>
				{/each}
			</ul>
		</SuggestionGroup>
	{/if}

	{#if platform.length > 0}
		<SuggestionGroup
			title={label(SUGGESTION_GROUPS.platform)}
			count={platform.length}
			keys={groupKeys(platform)}
			description={SUGGESTION_GROUP_DESCRIPTIONS[SUGGESTION_GROUPS.platform]}
			{headingLevel}
		>
			<ul class="flex flex-col divide-y divide-border">
				{#each platform as row (row.key)}
					<li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
						<span class="font-mono text-sm font-medium">{row.key}</span>
						<span class="text-xs text-foreground/70">{platformText(row.source)}</span>
					</li>
				{/each}
			</ul>
		</SuggestionGroup>
	{/if}

	{#if alreadySetLine}
		<p class="border-t border-border pt-2 text-xs wrap-anywhere text-foreground/70">
			{alreadySetLine}
		</p>
	{/if}
	{#if truncated}
		<p class="text-xs text-foreground/70">{SUGGESTION_COPY.truncated}</p>
	{/if}
</div>
