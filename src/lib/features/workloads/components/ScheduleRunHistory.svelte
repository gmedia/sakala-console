<script lang="ts">
	import { toast } from 'svelte-sonner';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import StopCircle from 'phosphor-svelte/lib/StopCircle';
	import { getErrorMessage } from '$lib/api/errors';
	import { SCHEDULE_RUN_TRIGGERS, type ScheduleRun } from '$lib/api/resources/schedules';
	import Button from '$lib/components/ui/Button.svelte';
	import { createCancelScheduleRunMutation } from '../mutations';
	import { createScheduleRunsQuery } from '../queries';
	import {
		isOpenRun,
		isRunNotOpenError,
		runDurationText,
		runExplanation,
		runHasOutput,
		runStatusView,
		SCHEDULE_COPY
	} from '../schedules';
	import { runAnchor } from '../schedule-panel';
	import { formatZonedTime } from '../time';
	import RunStatusBadge from './RunStatusBadge.svelte';
	import ScheduleRunLog from './ScheduleRunLog.svelte';

	type Props = {
		projectId: string;
		scheduleId: string;
		/** The schedule's timezone, in which every time is shown. */
		timezone: string;
		readOnly: boolean;
		/** The run whose log is open; the page keeps it in the address. */
		openRunId: string | null;
		onToggleLog: (runId: string | null) => void;
	};

	let { projectId, scheduleId, timezone, readOnly, openRunId, onToggleLog }: Props = $props();

	const runsQuery = createScheduleRunsQuery(
		() => projectId,
		() => scheduleId
	);
	const cancelMutation = createCancelScheduleRunMutation();

	const runs = $derived(runsQuery.data?.pages.flatMap((page) => page.data) ?? []);
	let stopping = $state<string | null>(null);
	let stopMessage = $state('');

	async function stop(run: ScheduleRun) {
		if (stopping) return;
		stopping = run.id;
		stopMessage = '';
		try {
			const result = await cancelMutation.mutateAsync({ projectId, scheduleId, runId: run.id });
			stopMessage = isOpenRun(result.status) ? SCHEDULE_COPY.stopRequested : '';
			if (!isOpenRun(result.status)) toast.success(SCHEDULE_COPY.stopped);
		} catch (error) {
			stopMessage = isRunNotOpenError(error)
				? SCHEDULE_COPY.stopNotOpen
				: getErrorMessage(error, SCHEDULE_COPY.stopFailed);
		} finally {
			stopping = null;
		}
	}

	/** The time a run's title names: when it was due, or when someone started it. */
	function titleTime(run: ScheduleRun): string {
		if (run.trigger === SCHEDULE_RUN_TRIGGERS.manual || !run.scheduled_for) {
			return run.created_at ? formatZonedTime(run.created_at, timezone) : '';
		}
		return formatZonedTime(run.scheduled_for, timezone);
	}

	function runTitle(run: ScheduleRun): string {
		if (run.trigger === SCHEDULE_RUN_TRIGGERS.manual || !run.scheduled_for) {
			return SCHEDULE_COPY.manualRun(titleTime(run));
		}
		return SCHEDULE_COPY.scheduledRun(titleTime(run));
	}

	/** The start, only when it says more than the title: a run that began later than it was due. */
	function startedText(run: ScheduleRun): string | null {
		if (!run.started_at) return null;
		const started = formatZonedTime(run.started_at, timezone);
		return started === titleTime(run) ? null : started;
	}
</script>

<section
	class="surface-card flex flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="schedule-history-title"
	data-testid="schedule-run-history"
>
	<!-- How long runs and logs are kept sits in the panel's Bantuan. -->
	<h2 id="schedule-history-title" class="font-sans text-base font-semibold text-foreground">
		{SCHEDULE_COPY.history}
	</h2>

	{#if stopMessage}
		<p role="status" class="text-sm text-foreground">{stopMessage}</p>
	{/if}

	{#if runsQuery.isPending}
		<div class="flex flex-col gap-2" role="status" aria-label="Memuat riwayat run">
			<div class="skeleton h-16 w-full"></div>
			<div class="skeleton h-16 w-full"></div>
		</div>
	{:else if runsQuery.isError}
		<p class="text-sm text-error-dark">
			{getErrorMessage(runsQuery.error, SCHEDULE_COPY.loadFailed)}
		</p>
	{:else if runs.length === 0}
		<p
			class="rounded-control border border-dashed border-border p-4 text-center text-sm text-foreground/70"
		>
			{SCHEDULE_COPY.historyEmpty}
		</p>
	{:else}
		<ol class="flex flex-col divide-y divide-border rounded-control border border-border">
			{#each runs as run (run.id)}
				{@const explanation = runExplanation(run)}
				{@const duration = runDurationText(run.duration_ms)}
				{@const logOpen = openRunId === run.id}
				{@const hasLog = runHasOutput(run) || isOpenRun(run.status)}
				{@const titleId = `run-${run.id}-title`}
				{@const started = startedText(run)}
				<!-- One line for the run: its status, when, how long, and how it ended. -->
				<li
					id={runAnchor(run.id)}
					class="flex scroll-mt-4 flex-col gap-1.5 px-3 py-2.5 sm:px-4"
					data-testid="schedule-run"
					data-status={run.status}
				>
					<div class="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
						<!-- From 640 px the actions keep their place on the right and the facts wrap instead. -->
						<div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:grow sm:basis-0">
							<RunStatusBadge status={run.status} />
							<h3 id={titleId} class="text-sm font-medium text-foreground tabular-nums">
								{runTitle(run)}
							</h3>
							{#if started || duration || run.exit_code !== null}
								<dl class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
									{#if started}
										<div class="flex gap-1">
											<dt class="text-foreground/70">{SCHEDULE_COPY.runStartedAt}</dt>
											<dd class="text-foreground tabular-nums">{started}</dd>
										</div>
									{/if}
									{#if duration}
										<div class="flex gap-1">
											<dt class="text-foreground/70">{SCHEDULE_COPY.runDuration}</dt>
											<dd class="text-foreground tabular-nums">{duration}</dd>
										</div>
									{/if}
									{#if run.exit_code !== null}
										<div class="flex gap-1">
											<dt class="text-foreground/70">{SCHEDULE_COPY.runExitCode}</dt>
											<dd class="font-mono text-foreground">{run.exit_code}</dd>
										</div>
									{/if}
								</dl>
							{/if}
						</div>
						<div class="flex shrink-0 flex-wrap items-center gap-1">
							{#if !readOnly && isOpenRun(run.status)}
								<Button
									variant="secondary"
									size="sm"
									onclick={() => stop(run)}
									disabled={stopping !== null}
									aria-busy={stopping === run.id}
								>
									<StopCircle size={16} aria-hidden="true" />
									{stopping === run.id ? SCHEDULE_COPY.stopping : SCHEDULE_COPY.stopRun}
								</Button>
							{/if}
							{#if hasLog}
								<Button
									variant="ghost"
									size="sm"
									aria-expanded={logOpen}
									aria-controls="run-{run.id}-log"
									onclick={() => onToggleLog(logOpen ? null : run.id)}
								>
									<CaretDown size={16} class={logOpen ? 'rotate-180' : ''} aria-hidden="true" />
									{logOpen ? SCHEDULE_COPY.hideLog : SCHEDULE_COPY.viewLog}
								</Button>
							{/if}
						</div>
					</div>

					<!-- Same size for every run; why one was missed or skipped is quieter context, a failure asks for a fix. -->
					{#if explanation}
						<p
							class={runStatusView(run.status).tone === 'error'
								? 'text-sm text-foreground'
								: 'text-sm text-foreground/70'}
						>
							{explanation}
						</p>
					{/if}

					<div id="run-{run.id}-log" hidden={!logOpen}>
						{#if logOpen && hasLog}
							<ScheduleRunLog
								{projectId}
								{scheduleId}
								runId={run.id}
								open={isOpenRun(run.status)}
								ran={hasLog}
								labelledBy={titleId}
							/>
						{/if}
					</div>
				</li>
			{/each}
		</ol>

		{#if runsQuery.hasNextPage}
			<div>
				<Button
					variant="secondary"
					onclick={() => runsQuery.fetchNextPage()}
					disabled={runsQuery.isFetchingNextPage}
				>
					{runsQuery.isFetchingNextPage ? SCHEDULE_COPY.loading : SCHEDULE_COPY.loadMore}
				</Button>
			</div>
		{/if}
	{/if}
</section>
