<script lang="ts">
	// The guide is a page on the landing site, outside this app's routes.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';
	import DatabaseIcon from 'phosphor-svelte/lib/DatabaseIcon';
	import InfoIcon from 'phosphor-svelte/lib/InfoIcon';
	import FormField from '$lib/components/ui/FormField.svelte';
	import {
		RELEASE_COMMAND_DOCS_URL,
		RELEASE_COMMAND_LABEL,
		RELEASE_COMMAND_SHORT_HELP
	} from '../../build-help';
	import { DATABASE_CHOICE_COPY, DATABASE_OPTIONS } from '../../first-deploy/database-choice';
	import type { FirstDeploySetup } from '../../first-deploy/use-first-deploy-setup.svelte';

	/**
	 * The one decision about a database before the first deploy. When the app likely needs one, the
	 * card is open and says why in plain words; otherwise a closed question keeps it out of the way
	 * with "Tanpa database" chosen (Hick's Law).
	 */
	type Props = { setup: FirstDeploySetup; disabled?: boolean };

	let { setup, disabled = false }: Props = $props();

	const id = $props.id();
	const likely = $derived(setup.hint?.likely ?? false);
	let opened = $state(false);
	const expanded = $derived(likely || opened);

	const createBlocked = $derived(setup.createBlockedReason !== null);
	const usableCandidates = $derived(
		setup.candidates.filter((item) => item.disabledReason === null)
	);
	const attachBlockedReason = $derived.by(() => {
		if (setup.candidatesLoading) return null;
		if (setup.candidatesFailed) return DATABASE_CHOICE_COPY.attachFailed;
		if (setup.candidates.length === 0) return DATABASE_CHOICE_COPY.attachEmpty;
		return usableCandidates.length === 0 ? DATABASE_CHOICE_COPY.attachNoneUsable : null;
	});
	const chosen = $derived(setup.option !== DATABASE_OPTIONS.none);
	/** MySQL matters once a Sakala database is chosen; SQLite matters most without one. */
	const showEngineNote = $derived(
		setup.engineNote !== null && (setup.hint?.engine === 'sqlite' || chosen)
	);
</script>

{#snippet optionLabel(title: string, hint: string, blocked: string | null)}
	<span class="flex min-w-0 flex-col">
		<span class="text-sm font-medium text-foreground">{title}</span>
		<span class="text-xs text-foreground/70">{blocked ?? hint}</span>
	</span>
{/snippet}

<section
	class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
	aria-labelledby="{id}-title"
	data-testid="database-choice"
>
	{#if likely}
		<div class="flex items-start gap-2">
			<DatabaseIcon class="mt-0.5 size-5 shrink-0 text-primary-dark" aria-hidden="true" />
			<div class="min-w-0">
				<h3 id="{id}-title" class="font-sans text-base font-semibold text-foreground">
					{DATABASE_CHOICE_COPY.title}
				</h3>
				{#if setup.signalsSentence}
					<p class="text-sm wrap-anywhere text-foreground/70" data-testid="database-signals">
						{setup.signalsSentence}
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<h3 id="{id}-title" class="font-sans text-sm font-semibold">
			<button
				type="button"
				class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left text-sm font-semibold text-foreground lg:min-h-control-md"
				aria-expanded={opened}
				aria-controls="{id}-options"
				onclick={() => (opened = !opened)}
			>
				<span class="flex items-center gap-2">
					<DatabaseIcon class="size-5 shrink-0 text-primary-dark" aria-hidden="true" />
					{DATABASE_CHOICE_COPY.disclosure}
				</span>
				<CaretDownIcon
					class={opened ? 'size-4 shrink-0 rotate-180' : 'size-4 shrink-0'}
					aria-hidden="true"
				/>
			</button>
		</h3>
	{/if}

	<div id="{id}-options" class="flex-col gap-3 {expanded ? 'flex' : 'hidden'}">
		<fieldset class="flex flex-col gap-2" {disabled}>
			<legend class="sr-only">Database untuk proyek ini</legend>
			<label
				class="flex items-start gap-3 rounded-control border border-border p-3 has-checked:border-primary has-checked:bg-primary-50 has-disabled:cursor-not-allowed {createBlocked
					? 'cursor-not-allowed opacity-70'
					: 'cursor-pointer hover:bg-background-soft'}"
			>
				<input
					type="radio"
					name="{id}-option"
					value={DATABASE_OPTIONS.create}
					bind:group={setup.option}
					disabled={createBlocked}
					class="mt-0.5 size-4 shrink-0 text-primary"
				/>
				{@render optionLabel(
					DATABASE_CHOICE_COPY.create,
					DATABASE_CHOICE_COPY.createHint,
					setup.createBlockedReason
				)}
			</label>
			<label
				class="flex items-start gap-3 rounded-control border border-border p-3 has-checked:border-primary has-checked:bg-primary-50 {attachBlockedReason
					? 'cursor-not-allowed opacity-70'
					: 'cursor-pointer hover:bg-background-soft'}"
			>
				<input
					type="radio"
					name="{id}-option"
					value={DATABASE_OPTIONS.attach}
					bind:group={setup.option}
					disabled={attachBlockedReason !== null}
					class="mt-0.5 size-4 shrink-0 text-primary"
				/>
				{@render optionLabel(
					DATABASE_CHOICE_COPY.attach,
					DATABASE_CHOICE_COPY.attachHint,
					attachBlockedReason
				)}
			</label>
			{#if setup.option === DATABASE_OPTIONS.attach}
				<div class="flex flex-col gap-1 pl-7">
					<label for="{id}-database" class="text-sm font-medium text-foreground">
						{DATABASE_CHOICE_COPY.attachSelect}
					</label>
					<select
						id="{id}-database"
						class="control-input"
						value={setup.databaseId ?? ''}
						onchange={(event) => (setup.databaseId = event.currentTarget.value)}
					>
						{#each setup.candidates as candidate (candidate.id)}
							<option value={candidate.id} disabled={candidate.disabledReason !== null}>
								{candidate.disabledReason
									? `${candidate.name} (${candidate.disabledReason})`
									: candidate.name}
							</option>
						{/each}
					</select>
				</div>
			{/if}
			<label
				class="flex cursor-pointer items-start gap-3 rounded-control border border-border p-3 hover:bg-background-soft has-checked:border-primary has-checked:bg-primary-50"
			>
				<input
					type="radio"
					name="{id}-option"
					value={DATABASE_OPTIONS.none}
					bind:group={setup.option}
					class="mt-0.5 size-4 shrink-0 text-primary"
				/>
				{@render optionLabel(DATABASE_CHOICE_COPY.none, DATABASE_CHOICE_COPY.noneHint, null)}
			</label>
		</fieldset>

		{#if showEngineNote}
			<p
				class="flex items-start gap-2 rounded-control bg-primary/8 p-3 text-sm text-primary-dark"
				data-testid="database-engine-note"
			>
				<InfoIcon class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<span>{setup.engineNote}</span>
			</p>
		{/if}

		{#if chosen}
			<p class="text-xs text-foreground/70">{DATABASE_CHOICE_COPY.variablesNote}</p>
			{#if setup.showReleaseCommand}
				<div class="flex flex-col gap-1">
					<FormField
						id="{id}-release"
						label={RELEASE_COMMAND_LABEL}
						bind:value={setup.releaseCommand}
						hint={RELEASE_COMMAND_SHORT_HELP}
						spellcheck={false}
						{disabled}
						inputClass="font-mono text-sm"
					/>
					<a
						href={RELEASE_COMMAND_DOCS_URL}
						target="_blank"
						rel="noreferrer noopener"
						class="inline-flex min-h-6 items-center gap-1 self-start text-xs font-medium text-primary-dark underline underline-offset-2"
					>
						Baca panduan release command
						<ArrowSquareOut size={12} aria-hidden="true" />
						<span class="sr-only">(tab baru)</span>
					</a>
				</div>
			{:else if setup.currentReleaseCommand}
				<p class="text-xs wrap-anywhere text-foreground/70">
					{RELEASE_COMMAND_LABEL} proyek ini tetap:
					<code class="font-mono">{setup.currentReleaseCommand}</code>
				</p>
			{/if}
		{/if}
	</div>
</section>
