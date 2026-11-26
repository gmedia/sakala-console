<script lang="ts">
	import { tick } from 'svelte';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Info from 'phosphor-svelte/lib/Info';
	import { ApiError } from '$lib/api/errors';
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import Button from '$lib/components/ui/Button.svelte';
	import FormField from '$lib/components/ui/FormField.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import ToggleField from '$lib/components/ui/ToggleField.svelte';
	import type { ResolvedPathname } from '$app/types';
	import { describeCron, nextCronRuns } from '../cron';
	import { createSaveScheduleMutation } from '../mutations';
	import {
		CRON_PRESET_IDS,
		cronError,
		cronPresets,
		emptyScheduleDraft,
		hasDaylightSavingRisk,
		hasScheduleDraftErrors,
		isScheduleQuotaFull,
		LARAVEL_SCHEDULER,
		randomPresetMinute,
		SCHEDULE_COPY,
		scheduleChanges,
		scheduleDraftErrors,
		scheduleDraftFrom,
		scheduleErrorsFromApi,
		schedulePayload,
		scheduleSaveErrorMessage,
		suggestionExpression,
		TIMEZONE_OPTIONS,
		type ScheduleDraft,
		type ScheduleDraftErrors,
		type ScheduleLimits
	} from '../schedules';
	import { formatZonedTime, timezoneAbbreviation } from '../time';

	type Props = {
		projectId: string;
		limits: ScheduleLimits;
		/** The schedule being changed; without it the form creates one. */
		schedule?: ProjectSchedule | null;
		/** Start from the Laravel scheduler suggestion. */
		laravelSuggestion?: boolean;
		cancelHref: ResolvedPathname;
		onSaved: (schedule: ProjectSchedule, created: boolean) => void;
	};

	let {
		projectId,
		limits,
		schedule = null,
		laravelSuggestion = false,
		cancelHref,
		onSaved
	}: Props = $props();

	/** Slots shown in the preview. */
	const PREVIEW_RUNS = 3;

	const saveMutation = createSaveScheduleMutation();
	const uid = $props.id();
	const ids = {
		name: `${uid}-name`,
		command: `${uid}-command`,
		expression: `${uid}-expression`,
		preview: `${uid}-preview`,
		advanced: `${uid}-advanced`,
		timezone: `${uid}-timezone`,
		timeout: `${uid}-timeout`
	};

	// Picked once, so the presets do not change under the reader (ADR-022: not all at minute 0).
	const presetMinute = randomPresetMinute();
	// The preview counts from when the form opened; a minute's drift does not change what it shows.
	const openedAt = new Date();

	function initialDraft(): ScheduleDraft {
		if (schedule) return scheduleDraftFrom(schedule);
		const minInterval = limits.minIntervalMinutes;
		if (laravelSuggestion) {
			return {
				...emptyScheduleDraft(limits, suggestionExpression(minInterval, presetMinute)),
				name: LARAVEL_SCHEDULER.name,
				command: LARAVEL_SCHEDULER.command
			};
		}
		const daily = cronPresets(minInterval, presetMinute).find(
			(preset) => preset.id === CRON_PRESET_IDS.daily
		);
		return emptyScheduleDraft(limits, daily?.expression ?? '');
	}

	/** Open when the schedule already uses something other than the defaults, so it is not hidden. */
	function initialAdvancedOpen(): boolean {
		return (
			schedule !== null &&
			(schedule.timezone !== limits.defaultTimezone ||
				schedule.timeout_seconds !== limits.defaultTimeoutSeconds)
		);
	}

	let draft = $state<ScheduleDraft>(initialDraft());
	let errors = $state<ScheduleDraftErrors>({});
	let formError = $state('');
	let advancedOpen = $state(initialAdvancedOpen());
	let submitting = false;

	const presets = $derived(cronPresets(limits.minIntervalMinutes, presetMinute));
	const selectedPreset = $derived(
		presets.find((preset) => preset.expression === draft.cron_expression.trim())?.id ??
			CRON_PRESET_IDS.custom
	);
	const timezoneOptions = $derived(
		TIMEZONE_OPTIONS.some((option) => option.value === draft.timezone)
			? TIMEZONE_OPTIONS
			: [...TIMEZONE_OPTIONS, { value: draft.timezone, label: draft.timezone }]
	);
	const zone = $derived(timezoneAbbreviation(draft.timezone));
	const description = $derived(describeCron(draft.cron_expression));
	const nextRuns = $derived(
		nextCronRuns(draft.cron_expression, draft.timezone, PREVIEW_RUNS, openedAt)
	);
	// Said live, in the preview, before anything is sent: the field error waits for Simpan.
	const previewProblem = $derived(
		cronError(draft.cron_expression, draft.timezone, limits.minIntervalMinutes, openedAt)
	);
	const quotaFull = $derived(isScheduleQuotaFull(limits) && !schedule?.enabled);

	function update<Field extends keyof ScheduleDraft>(field: Field, value: ScheduleDraft[Field]) {
		draft[field] = value;
		if (field !== 'enabled') errors[field as keyof ScheduleDraftErrors] = undefined;
		formError = '';
	}

	function choosePreset(id: string) {
		const preset = presets.find((item) => item.id === id);
		if (preset) update('cron_expression', preset.expression);
		else void tick().then(() => document.getElementById(ids.expression)?.focus());
	}

	async function focusFirstError() {
		await tick();
		const order: [keyof ScheduleDraftErrors, string][] = [
			['name', ids.name],
			['command', ids.command],
			['cron_expression', ids.expression],
			['timezone', ids.timezone],
			['timeout_seconds', ids.timeout]
		];
		const first = order.find(([field]) => errors[field]);
		if (first) document.getElementById(first[1])?.focus();
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (submitting) return;
		errors = scheduleDraftErrors(draft, limits, new Date());
		if (errors.timezone || errors.timeout_seconds) advancedOpen = true;
		if (hasScheduleDraftErrors(errors)) {
			void focusFirstError();
			return;
		}

		const payload = schedule ? scheduleChanges(draft, schedule) : schedulePayload(draft);
		if (schedule && Object.keys(payload).length === 0) {
			onSaved(schedule, false);
			return;
		}

		submitting = true;
		try {
			const saved = await saveMutation.mutateAsync({
				projectId,
				scheduleId: schedule?.id,
				payload
			});
			onSaved(saved, !schedule);
		} catch (error) {
			if (
				error instanceof ApiError &&
				error.isValidationError &&
				Object.keys(error.errors).length
			) {
				errors = scheduleErrorsFromApi(error.errors);
				if (errors.timezone || errors.timeout_seconds) advancedOpen = true;
				if (hasScheduleDraftErrors(errors)) {
					void focusFirstError();
					return;
				}
			}
			formError = scheduleSaveErrorMessage(error, SCHEDULE_COPY.saveFailed);
		} finally {
			submitting = false;
		}
	}
</script>

<form class="flex flex-col gap-6" novalidate onsubmit={handleSubmit} data-testid="schedule-form">
	{#if laravelSuggestion && !schedule}
		<p
			class="flex gap-2 rounded-control border border-primary/20 bg-primary-50 p-3 text-sm text-foreground"
		>
			<Info size={18} class="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
			<span>{LARAVEL_SCHEDULER.note}</span>
		</p>
	{/if}

	<div class="flex flex-col gap-5">
		<FormField
			id={ids.name}
			label={SCHEDULE_COPY.nameLabel}
			placeholder="Laporan harian"
			autocomplete="off"
			bind:value={() => draft.name, (value) => update('name', value)}
			error={errors.name}
		/>
		<FormField
			id={ids.command}
			label={SCHEDULE_COPY.commandLabel}
			hint={SCHEDULE_COPY.commandHint}
			placeholder="php artisan report:daily"
			spellcheck={false}
			autocomplete="off"
			inputClass="font-mono"
			bind:value={() => draft.command, (value) => update('command', value)}
			error={errors.command}
		/>
	</div>

	<fieldset class="flex flex-col gap-4 border-t border-border pt-5">
		<legend class="float-left mb-1 font-sans text-base font-semibold text-foreground">
			{SCHEDULE_COPY.whenLabel}
		</legend>
		<fieldset class="clear-both flex flex-col gap-2">
			<!-- Named for screen readers; on screen the chips under "Kapan" read as choices already. -->
			<legend class="sr-only">{SCHEDULE_COPY.presetsLabel}</legend>
			<div class="flex flex-wrap gap-2">
				{#each [...presets, { id: CRON_PRESET_IDS.custom, label: SCHEDULE_COPY.customPreset, expression: '' }] as preset (preset.id)}
					<label
						class="inline-flex min-h-control-sm cursor-pointer items-center rounded-full border px-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2 max-lg:min-h-control-lg {selectedPreset ===
						preset.id
							? 'border-primary bg-primary-50 font-medium text-primary-dark'
							: 'border-border-strong bg-surface text-foreground hover:border-primary'}"
					>
						<input
							type="radio"
							name="{uid}-preset"
							value={preset.id}
							checked={selectedPreset === preset.id}
							onchange={() => choosePreset(preset.id)}
							class="sr-only"
						/>
						{preset.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<FormField
			id={ids.expression}
			label={SCHEDULE_COPY.expressionLabel}
			hint={SCHEDULE_COPY.expressionHint}
			placeholder="30 2 * * *"
			spellcheck={false}
			autocomplete="off"
			inputClass="font-mono"
			bind:value={() => draft.cron_expression, (value) => update('cron_expression', value)}
			error={errors.cron_expression}
		/>

		<div
			id={ids.preview}
			class="rounded-control border border-border bg-background-soft p-3 text-sm"
			aria-live="polite"
			data-testid="schedule-preview"
		>
			{#if previewProblem && !errors.cron_expression}
				<p class="text-foreground">{previewProblem}</p>
			{:else if !previewProblem}
				{#if description}
					<p class="font-medium text-foreground">{description} {zone}</p>
				{/if}
				<p class="mt-2 text-xs font-medium text-foreground/70">{SCHEDULE_COPY.previewTitle}</p>
				{#if nextRuns.length > 0}
					<ol class="mt-1 flex flex-col gap-0.5 text-foreground tabular-nums">
						{#each nextRuns as run (run.getTime())}
							<li>{formatZonedTime(run, draft.timezone)}</li>
						{/each}
					</ol>
				{:else}
					<p class="mt-1 text-foreground">{SCHEDULE_COPY.previewNone}</p>
				{/if}
			{/if}
		</div>
		<!-- One "Pelajari" for the command and the cron format, so each field keeps a one-line hint. -->
		<LearnMore topic={SCHEDULE_COPY.formLearnTopic}>
			<dl class="flex flex-col gap-2">
				<div>
					<dt class="font-medium text-foreground">{SCHEDULE_COPY.commandLabel}</dt>
					<dd>{SCHEDULE_COPY.commandLearn}</dd>
				</div>
				<div>
					<dt class="font-medium text-foreground">{SCHEDULE_COPY.expressionLabel}</dt>
					<dd>{SCHEDULE_COPY.expressionLearn}</dd>
				</div>
			</dl>
		</LearnMore>
	</fieldset>

	<section class="border-t border-border pt-3" aria-labelledby="{ids.advanced}-toggle">
		<button
			id="{ids.advanced}-toggle"
			type="button"
			class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left text-sm font-medium text-foreground lg:min-h-control-md"
			aria-expanded={advancedOpen}
			aria-controls={ids.advanced}
			onclick={() => (advancedOpen = !advancedOpen)}
		>
			<span>{SCHEDULE_COPY.advancedToggle}</span>
			<CaretDown
				size={16}
				class={advancedOpen ? 'shrink-0 rotate-180' : 'shrink-0'}
				aria-hidden="true"
			/>
		</button>
		<div id={ids.advanced} class="mt-3 flex flex-col gap-5" hidden={!advancedOpen}>
			<div class="space-y-1.5">
				<label for={ids.timezone} class="block text-sm font-medium text-foreground"
					>{SCHEDULE_COPY.timezoneLabel}</label
				>
				<select
					id={ids.timezone}
					class="control-input max-w-xs"
					value={draft.timezone}
					onchange={(event) => update('timezone', event.currentTarget.value)}
					aria-describedby="{ids.timezone}-hint"
					aria-invalid={errors.timezone ? 'true' : undefined}
				>
					{#each timezoneOptions as option (option.value)}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
				<p id="{ids.timezone}-hint" class="text-xs text-foreground/70">
					{SCHEDULE_COPY.timezoneHint}
					{#if hasDaylightSavingRisk(draft.timezone)}
						{SCHEDULE_COPY.dstNote}
					{/if}
				</p>
				{#if errors.timezone}
					<p class="text-xs text-error-base">{errors.timezone}</p>
				{/if}
			</div>
			<FormField
				id={ids.timeout}
				label={SCHEDULE_COPY.timeoutLabel}
				hint={SCHEDULE_COPY.timeoutHint(limits.maxTimeoutSeconds)}
				inputmode="numeric"
				inputClass="max-w-32 tabular-nums"
				bind:value={() => draft.timeout_seconds, (value) => update('timeout_seconds', value)}
				error={errors.timeout_seconds}
			/>
		</div>
	</section>

	<div class="border-t border-border pt-2">
		<ToggleField
			title={SCHEDULE_COPY.enabledLabel}
			description={quotaFull && !draft.enabled
				? `${SCHEDULE_COPY.enabledHint} Workspace ini sudah memakai semua jadwal aktifnya, jadi jadwal ini disimpan nonaktif sampai ada yang dinonaktifkan.`
				: SCHEDULE_COPY.enabledHint}
			checked={draft.enabled}
			onToggle={() => update('enabled', !draft.enabled)}
		/>
	</div>

	<div class="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
		{#if formError}
			<p role="alert" class="mr-auto text-sm text-error-dark">{formError}</p>
		{/if}
		<Button variant="ghost" href={cancelHref}>{SCHEDULE_COPY.cancel}</Button>
		<Button type="submit" disabled={saveMutation.isPending} aria-busy={saveMutation.isPending}>
			{#if saveMutation.isPending}
				<CircleNotch
					size={16}
					weight="bold"
					class="animate-spin motion-reduce:animate-none"
					aria-hidden="true"
				/>
			{/if}
			{saveMutation.isPending ? SCHEDULE_COPY.saving : SCHEDULE_COPY.save}
		</Button>
	</div>
</form>
