<script lang="ts">
	import { tick } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import { getErrorMessage } from '$lib/api/errors';
	import { WAITING_RUN_STATUS } from '$lib/api/resources/schedules';
	import { SCHEDULE_RUN_REFUSAL_REASONS } from '$lib/api/resources/workload-refusals';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import { EditIcon, ErrorIcon, PauseIcon, RunIcon, ScheduleIcon } from '$lib/components/icons';
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import InlineEditButton from '$lib/components/ui/InlineEditButton.svelte';
	import InlineRenameForm from '$lib/components/ui/InlineRenameForm.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import { useWorkloadAvailability } from '../availability.svelte';
	import { describeCron } from '../cron';
	import { createRunScheduleNowMutation, createSaveScheduleMutation } from '../mutations';
	import { createScheduleQuery, isFeatureOffError } from '../queries';
	import { SCHEDULE_RULES } from '../rules';
	import { editScheduleHref, RUN_PARAM, schedulesHref } from '../routes';
	import { SCHEDULE_PANEL_COPY as FACTS } from '../schedule-panel';
	import {
		pausedNotice,
		runNowRefusal,
		SCHEDULE_COPY,
		scheduleLimits,
		scheduleSaveErrorMessage,
		scheduleStateView,
		type RunNowRefusal
	} from '../schedules';
	import { formatZonedTime, timezoneAbbreviation } from '../time';
	import ScheduleDangerZone from './ScheduleDangerZone.svelte';
	import SchedulePanel from './SchedulePanel.svelte';
	import ScheduleRunHistory from './ScheduleRunHistory.svelte';
	import ScheduleStateBadge from './ScheduleStateBadge.svelte';
	import ScheduleTimeoutForm from './ScheduleTimeoutForm.svelte';

	type Props = { projectId: string; scheduleId: string };

	let { projectId, scheduleId }: Props = $props();

	const EDITOR_IDS = { name: 'schedule-rename', timeout: 'schedule-timeout' } as const;

	const projectQuery = createProjectQuery(() => projectId);
	const access = useProjectAccess(() => projectQuery.data);
	// The header and sidebar read the same workspace limits, so this asks the API for nothing new.
	const workloads = useWorkloadAvailability(() => projectQuery.data);
	const limits = $derived(scheduleLimits(workloads.limits));
	const scheduleQuery = createScheduleQuery(
		() => projectId,
		() => scheduleId
	);
	const runNowMutation = createRunScheduleNowMutation();
	const saveMutation = createSaveScheduleMutation();

	const schedule = $derived(scheduleQuery.data);
	const canManage = $derived(!access.readOnly);
	const stateView = $derived(schedule ? scheduleStateView(schedule) : null);
	const description = $derived(schedule ? describeCron(schedule.cron_expression) : null);
	const zone = $derived(schedule ? timezoneAbbreviation(schedule.timezone) : '');
	// Seeded from `?run=`, then kept here: a shallow replaceState does not change `page.url`.
	let openRunId = $state(page.url.searchParams.get(RUN_PARAM));
	const backHref = $derived(schedulesHref(projectId));

	let refusal = $state<RunNowRefusal | null>(null);
	let actionMessage = $state('');
	let actionError = $state('');

	// Renaming and the time limit are rare, one field each: they open in place, next to their value.
	let editing = $state<'name' | 'timeout' | null>(null);
	let nameTrigger = $state<HTMLElement | null>(null);
	let timeoutTrigger = $state<HTMLElement | null>(null);

	async function closeEditor() {
		const trigger = editing === 'name' ? nameTrigger : timeoutTrigger;
		editing = null;
		await tick();
		trigger?.focus();
	}

	function toggleEditor(part: 'name' | 'timeout') {
		if (editing === part) void closeEditor();
		else editing = part;
	}

	function toggleLog(runId: string | null) {
		openRunId = runId;
		const url = new URL(page.url);
		if (runId) url.searchParams.set(RUN_PARAM, runId);
		else url.searchParams.delete(RUN_PARAM);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- this page, with a new query
		replaceState(url, page.state);
	}

	async function runNow() {
		if (!schedule || runNowMutation.isPending) return;
		refusal = null;
		actionError = '';
		actionMessage = '';
		try {
			const run = await runNowMutation.mutateAsync({ projectId, scheduleId: schedule.id });
			actionMessage =
				run.status === WAITING_RUN_STATUS ? SCHEDULE_COPY.runWaiting : SCHEDULE_COPY.runStarted;
			toggleLog(run.id);
		} catch (error) {
			refusal = runNowRefusal(error);
			if (!refusal) actionError = getErrorMessage(error, SCHEDULE_COPY.runFailed);
		}
	}

	async function setEnabled(enabled: boolean) {
		if (!schedule || saveMutation.isPending) return;
		actionError = '';
		actionMessage = '';
		try {
			const saved = await saveMutation.mutateAsync({
				projectId,
				scheduleId: schedule.id,
				payload: { enabled }
			});
			actionMessage = enabled
				? SCHEDULE_COPY.resumed(saved.name)
				: SCHEDULE_COPY.paused(saved.name);
		} catch (error) {
			actionError = scheduleSaveErrorMessage(error, SCHEDULE_COPY.saveFailed);
		}
	}
</script>

<div class="flex w-full flex-col gap-4">
	<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus an anchor -->
	<a
		href={backHref}
		class="inline-flex min-h-control-sm w-fit items-center gap-1.5 rounded-control text-sm font-medium text-foreground/70 hover:text-foreground max-lg:min-h-control-lg"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{SCHEDULE_COPY.backToSettings}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if scheduleQuery.isPending}
		<div class="flex max-w-reading flex-col gap-4" role="status" aria-label="Memuat jadwal">
			<div class="skeleton h-40 w-full"></div>
			<div class="skeleton h-64 w-full"></div>
		</div>
	{:else if scheduleQuery.isError || !schedule || !stateView}
		<div class="max-w-reading">
			<ErrorBlock
				icon={ScheduleIcon}
				title={isFeatureOffError(scheduleQuery.error)
					? SCHEDULE_COPY.notFound
					: SCHEDULE_COPY.loadFailed}
				description={isFeatureOffError(scheduleQuery.error)
					? SCHEDULE_COPY.notFoundHint
					: getErrorMessage(scheduleQuery.error, SCHEDULE_COPY.loadFailed)}
				onRetry={isFeatureOffError(scheduleQuery.error) ? undefined : () => scheduleQuery.refetch()}
				links={[{ label: SCHEDULE_COPY.backToSettings, href: schedulesHref(projectId) }]}
			/>
		</div>
	{:else}
		{#snippet panel()}
			<SchedulePanel {schedule} {canManage} />
		{/snippet}
		{#snippet danger()}
			<ScheduleDangerZone {projectId} {schedule} />
		{/snippet}
		<!-- The form template: the schedule and its runs left, the panel right, deleting last. -->
		<FormPageLayout panelLabel={FACTS.label} {panel} after={canManage ? danger : undefined}>
			<section
				class="surface-card flex flex-col gap-4 p-4 sm:p-6"
				aria-labelledby="schedule-title"
				data-testid="schedule-detail"
			>
				<!-- The schedule's facts in one line under its name, like a project's header; on a phone each fact
					 wraps to its own line, so the dots that separate them would only start lines. -->
				<div class="flex min-w-0 flex-col gap-2">
					<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
						<h2
							id="schedule-title"
							class="min-w-0 font-display text-xl font-semibold wrap-anywhere text-foreground"
						>
							{schedule.name}
						</h2>
						{#if canManage}
							<InlineEditButton
								subject={FACTS.nameSubject}
								expanded={editing === 'name'}
								controls={EDITOR_IDS.name}
								onclick={() => toggleEditor('name')}
								bind:ref={nameTrigger}
								testid="edit-schedule-name"
							/>
						{/if}
					</div>
					{#if editing === 'name'}
						<InlineRenameForm
							id={EDITOR_IDS.name}
							label={SCHEDULE_COPY.nameLabel}
							hint={FACTS.nameHint}
							value={schedule.name}
							maxLength={SCHEDULE_RULES.nameMaxLength}
							noun="jadwal"
							save={(name) =>
								saveMutation.mutateAsync({ projectId, scheduleId: schedule.id, payload: { name } })}
							errorMessage={(error) => scheduleSaveErrorMessage(error, SCHEDULE_COPY.saveFailed)}
							onClose={closeEditor}
							testid="schedule-rename"
						/>
					{/if}
					<p
						class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted"
						data-testid="schedule-facts"
					>
						<ScheduleStateBadge {schedule} />
						<span class="text-foreground">
							{description ? `${description} ${zone}` : schedule.cron_expression}
						</span>
						<span class="max-sm:hidden" aria-hidden="true">·</span>
						<span class="text-foreground tabular-nums" data-testid="schedule-next-run">
							{schedule.next_run_at
								? FACTS.next(formatZonedTime(schedule.next_run_at, schedule.timezone))
								: SCHEDULE_COPY.notScheduled}
						</span>
						<span class="max-sm:hidden" aria-hidden="true">·</span>
						<!-- The value and its Ubah wrap together, so the action never lands on a line of its own. -->
						<span class="inline-flex items-center gap-1">
							<span class="tabular-nums" data-testid="schedule-timeout-value"
								>{FACTS.timeout(SCHEDULE_COPY.seconds(schedule.timeout_seconds))}</span
							>
							{#if canManage}
								<InlineEditButton
									subject={FACTS.timeoutSubject}
									expanded={editing === 'timeout'}
									controls={EDITOR_IDS.timeout}
									onclick={() => toggleEditor('timeout')}
									bind:ref={timeoutTrigger}
									testid="edit-schedule-timeout"
								/>
							{/if}
						</span>
					</p>
					{#if editing === 'timeout'}
						<ScheduleTimeoutForm
							id={EDITOR_IDS.timeout}
							{projectId}
							{schedule}
							{limits}
							onClose={closeEditor}
						/>
					{/if}
				</div>

				<!-- The expression and the command read like a crontab line; the line above says it in words. -->
				<code
					class="block rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
					data-testid="schedule-command"
					><span class="text-foreground/70">{schedule.cron_expression}</span
					>&nbsp;&nbsp;{schedule.command}</code
				>

				{#if stateView.key === 'paused' && schedule.paused_at}
					<div
						class="flex flex-col gap-3 rounded-control border border-error/30 bg-error-50 p-3 sm:flex-row sm:items-center sm:justify-between"
						data-testid="schedule-paused"
					>
						<p class="flex gap-2 text-sm text-foreground">
							<ErrorIcon size={18} class="mt-0.5 shrink-0 text-error-dark" aria-hidden="true" />
							<span
								>{pausedNotice(
									schedule,
									formatZonedTime(schedule.paused_at, schedule.timezone)
								)}</span
							>
						</p>
						{#if canManage}
							<Button
								variant="secondary"
								size="sm"
								class="shrink-0"
								onclick={() => setEnabled(true)}
								disabled={saveMutation.isPending}
							>
								<RunIcon size={16} aria-hidden="true" />
								{SCHEDULE_COPY.resume}
							</Button>
						{/if}
					</div>
				{/if}

				{#if canManage}
					<div class="flex flex-wrap items-center gap-2">
						<Button
							onclick={runNow}
							disabled={runNowMutation.isPending}
							aria-busy={runNowMutation.isPending}
						>
							<RunIcon size={16} weight="fill" aria-hidden="true" />
							{runNowMutation.isPending ? SCHEDULE_COPY.running : SCHEDULE_COPY.runNow}
						</Button>
						<Button variant="secondary" href={editScheduleHref(projectId, schedule.id)}>
							<EditIcon size={16} aria-hidden="true" />
							{FACTS.editAll}
						</Button>
						{#if schedule.enabled}
							<Button
								variant="secondary"
								onclick={() => setEnabled(false)}
								disabled={saveMutation.isPending}
							>
								<PauseIcon size={16} aria-hidden="true" />
								{SCHEDULE_COPY.pause}
							</Button>
						{:else if stateView.key !== 'paused'}
							<Button
								variant="secondary"
								onclick={() => setEnabled(true)}
								disabled={saveMutation.isPending}
							>
								<RunIcon size={16} aria-hidden="true" />
								{SCHEDULE_COPY.resume}
							</Button>
						{/if}
					</div>
				{:else}
					<p class="text-xs text-foreground/70">{SCHEDULE_COPY.readOnly}</p>
				{/if}

				{#if refusal}
					<div
						role="alert"
						class="rounded-control border border-warning/30 bg-accent-soft p-3 text-sm text-foreground"
						data-testid="run-now-refused"
					>
						<p>{refusal.message}</p>
						{#if refusal.reason === SCHEDULE_RUN_REFUSAL_REASONS.noLiveDeployment}
							<a
								href={resolve(`/projects/${projectId}/deployments`)}
								class="mt-1 inline-block font-medium text-primary-dark underline underline-offset-2"
								>Buka Riwayat deployment</a
							>
						{/if}
					</div>
				{:else if actionError}
					<p role="alert" class="text-sm text-error-dark">{actionError}</p>
				{/if}
				<p role="status" class="text-sm text-foreground/70 empty:hidden">{actionMessage}</p>
			</section>

			<ScheduleRunHistory
				{projectId}
				scheduleId={schedule.id}
				timezone={schedule.timezone}
				readOnly={!canManage}
				{openRunId}
				onToggleLog={toggleLog}
			/>
		</FormPageLayout>
	{/if}
</div>
