<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import Lightbulb from 'phosphor-svelte/lib/Lightbulb';
	import Plus from 'phosphor-svelte/lib/Plus';
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import Button from '$lib/components/ui/Button.svelte';
	import { buttonClasses } from '$lib/components/ui/button-classes';
	import { SETTINGS_SECTION_IDS } from '$lib/features/projects/settings-anchors';
	import { formatRelativeTime } from '$lib/utils/date';
	import { describeCron } from '../cron';
	import { createSchedulesQuery, isFeatureOffError } from '../queries';
	import { newScheduleHref, scheduleHref, suggestedScheduleHref } from '../routes';
	import {
		SCHEDULE_COPY,
		scheduleLimits,
		scheduleQuotaText,
		scheduleSuggestion
	} from '../schedules';
	import { formatZonedTime, timezoneAbbreviation } from '../time';
	import RunStatusBadge from './RunStatusBadge.svelte';
	import ScheduleStateBadge from './ScheduleStateBadge.svelte';

	type Props = {
		projectId: string;
		/** The detected framework, for the Laravel suggestion. */
		framework?: string | null;
		limits?: PilotLimits;
		readOnly: boolean;
	};

	let { projectId, framework = null, limits, readOnly }: Props = $props();

	const sectionId = SETTINGS_SECTION_IDS.schedules;
	const schedulesQuery = createSchedulesQuery(
		() => projectId,
		() => true
	);

	const schedules = $derived(schedulesQuery.data ?? []);
	const quotaText = $derived(scheduleQuotaText(scheduleLimits(limits)));
	const suggestion = $derived(readOnly ? null : scheduleSuggestion(framework, schedules));

	let arrived = false;
	$effect(() => {
		if (arrived || schedulesQuery.isPending || page.url.hash !== `#${sectionId}`) return;
		arrived = true;
		void tick().then(() => document.getElementById(sectionId)?.scrollIntoView({ block: 'start' }));
	});
</script>

<section
	id={sectionId}
	aria-labelledby="{sectionId}-title"
	class="surface-card flex scroll-mt-4 flex-col gap-4 p-4 sm:p-6"
	data-testid="schedules-section"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0 flex-1 basis-64">
			<h2 id="{sectionId}-title" class="font-sans text-base font-semibold text-foreground">
				{SCHEDULE_COPY.section}
			</h2>
			<p class="mt-1 text-sm text-foreground/70">{SCHEDULE_COPY.intro}</p>
		</div>
		{#if !readOnly && schedulesQuery.isSuccess}
			<Button variant="secondary" href={newScheduleHref(projectId)}>
				<Plus size={16} aria-hidden="true" />
				{SCHEDULE_COPY.create}
			</Button>
		{/if}
	</div>

	{#if schedulesQuery.isPending}
		<div class="flex flex-col gap-2" role="status" aria-label="Memuat jadwal">
			<div class="skeleton h-20 w-full"></div>
		</div>
	{:else if schedulesQuery.isError}
		<p class="text-sm text-muted" data-testid="schedules-unavailable">
			{isFeatureOffError(schedulesQuery.error)
				? SCHEDULE_COPY.unavailable
				: SCHEDULE_COPY.loadFailed}
		</p>
	{:else}
		{#if schedules.length === 0}
			<div class="rounded-control border border-dashed border-border p-4 text-center">
				<p class="text-sm font-medium text-foreground">{SCHEDULE_COPY.emptyTitle}</p>
				<p class="mt-1 text-sm text-foreground/70">{SCHEDULE_COPY.emptyDescription}</p>
			</div>
		{:else}
			<ul class="flex flex-col divide-y divide-border rounded-control border border-border">
				{#each schedules as schedule (schedule.id)}
					{@const description = describeCron(schedule.cron_expression)}
					{@const zone = timezoneAbbreviation(schedule.timezone)}
					<li class="flex flex-col gap-2 p-3 sm:p-4" data-testid="schedule-row">
						<div class="flex flex-wrap items-center gap-2">
							<a
								href={scheduleHref(projectId, schedule.id)}
								class="min-w-0 font-semibold wrap-anywhere text-foreground underline-offset-2 hover:text-primary hover:underline"
								>{schedule.name}</a
							>
							<ScheduleStateBadge {schedule} />
						</div>
						<p class="text-sm text-foreground">
							{description ? `${description} ${zone}` : schedule.cron_expression}
							<code class="ml-1 font-mono text-xs text-foreground/70"
								>{schedule.cron_expression}</code
							>
						</p>
						<dl class="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
							<div class="flex flex-wrap gap-x-1">
								<dt class="text-foreground/70">{SCHEDULE_COPY.nextRun}:</dt>
								<dd class="text-foreground">
									{schedule.next_run_at
										? formatZonedTime(schedule.next_run_at, schedule.timezone)
										: SCHEDULE_COPY.notScheduled}
								</dd>
							</div>
							<div class="flex flex-wrap items-center gap-x-1">
								<dt class="text-foreground/70">{SCHEDULE_COPY.lastRun}:</dt>
								<dd class="flex flex-wrap items-center gap-1 text-foreground">
									{#if schedule.latest_run}
										<RunStatusBadge status={schedule.latest_run.status} />
										<span>{formatRelativeTime(schedule.latest_run.created_at)}</span>
									{:else}
										{SCHEDULE_COPY.noRunYet}
									{/if}
								</dd>
							</div>
						</dl>
					</li>
				{/each}
			</ul>
		{/if}

		{#if suggestion}
			<div
				class="flex flex-col gap-3 rounded-control border border-primary/20 bg-primary-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
				data-testid="schedule-suggestion"
			>
				<div class="flex min-w-0 gap-2">
					<Lightbulb size={20} class="mt-0.5 shrink-0 text-primary-dark" aria-hidden="true" />
					<div class="min-w-0">
						<p class="text-sm font-medium text-foreground">{SCHEDULE_COPY.suggestionTitle}</p>
						<code class="font-mono text-xs wrap-anywhere text-foreground">{suggestion.command}</code
						>
					</div>
				</div>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus a query -->
				<a
					href={suggestedScheduleHref(projectId)}
					class={buttonClasses('secondary', 'sm', 'shrink-0')}>{SCHEDULE_COPY.suggestionUse}</a
				>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/if}

		<div class="flex flex-col gap-1 text-xs text-foreground/70">
			{#if quotaText}
				<p data-testid="schedule-quota">{quotaText}</p>
			{/if}
			{#if readOnly}
				<p>{SCHEDULE_COPY.readOnly}</p>
			{/if}
		</div>
	{/if}
</section>
