<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import Pause from 'phosphor-svelte/lib/Pause';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Play from 'phosphor-svelte/lib/Play';
	import Trash from 'phosphor-svelte/lib/Trash';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import { getErrorMessage } from '$lib/api/errors';
	import { WAITING_RUN_STATUS } from '$lib/api/resources/schedules';
	import { SCHEDULE_RUN_REFUSAL_REASONS } from '$lib/api/resources/workload-refusals';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import { describeCron } from '../cron';
	import {
		createDeleteScheduleMutation,
		createRunScheduleNowMutation,
		createSaveScheduleMutation
	} from '../mutations';
	import { createScheduleQuery, isFeatureOffError } from '../queries';
	import { editScheduleHref, RUN_PARAM, schedulesHref } from '../routes';
	import {
		pausedNotice,
		runNowRefusal,
		SCHEDULE_COPY,
		scheduleSaveErrorMessage,
		scheduleStateView,
		type RunNowRefusal
	} from '../schedules';
	import { formatZonedTime, timezoneAbbreviation } from '../time';
	import ScheduleRunHistory from './ScheduleRunHistory.svelte';
	import ScheduleStateBadge from './ScheduleStateBadge.svelte';

	type Props = { projectId: string; scheduleId: string };

	let { projectId, scheduleId }: Props = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const access = useProjectAccess(() => projectQuery.data);
	const scheduleQuery = createScheduleQuery(
		() => projectId,
		() => scheduleId
	);
	const runNowMutation = createRunScheduleNowMutation();
	const saveMutation = createSaveScheduleMutation();
	const deleteMutation = createDeleteScheduleMutation();

	const schedule = $derived(scheduleQuery.data);
	const stateView = $derived(schedule ? scheduleStateView(schedule) : null);
	const description = $derived(schedule ? describeCron(schedule.cron_expression) : null);
	const zone = $derived(schedule ? timezoneAbbreviation(schedule.timezone) : '');
	// Seeded from `?run=`, then kept here: a shallow replaceState does not change `page.url`.
	let openRunId = $state(page.url.searchParams.get(RUN_PARAM));
	const backHref = $derived(schedulesHref(projectId));

	let refusal = $state<RunNowRefusal | null>(null);
	let actionMessage = $state('');
	let actionError = $state('');
	let deleteOpen = $state(false);
	let deleteError = $state('');

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

	async function confirmDelete() {
		if (!schedule || deleteMutation.isPending) return;
		deleteError = '';
		const name = schedule.name;
		try {
			await deleteMutation.mutateAsync({ projectId, scheduleId: schedule.id });
			deleteOpen = false;
			toast.success(SCHEDULE_COPY.deleted(name));
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved, plus an anchor
			await goto(backHref);
		} catch (error) {
			deleteError = getErrorMessage(error, SCHEDULE_COPY.deleteFailed);
		}
	}
</script>

<div class="flex w-full max-w-reading flex-col gap-4">
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
		<div class="flex flex-col gap-4" role="status" aria-label="Memuat jadwal">
			<div class="skeleton h-40 w-full"></div>
			<div class="skeleton h-64 w-full"></div>
		</div>
	{:else if scheduleQuery.isError || !schedule || !stateView}
		<ErrorBlock
			icon={CalendarBlank}
			title={isFeatureOffError(scheduleQuery.error)
				? SCHEDULE_COPY.notFound
				: SCHEDULE_COPY.loadFailed}
			description={isFeatureOffError(scheduleQuery.error)
				? SCHEDULE_COPY.notFoundHint
				: getErrorMessage(scheduleQuery.error, SCHEDULE_COPY.loadFailed)}
			onRetry={isFeatureOffError(scheduleQuery.error) ? undefined : () => scheduleQuery.refetch()}
			links={[
				{ label: SCHEDULE_COPY.backToSettings, href: resolve(`/projects/${projectId}/settings`) }
			]}
		/>
	{:else}
		<section
			class="surface-card flex flex-col gap-4 p-4 sm:p-6"
			aria-labelledby="schedule-title"
			data-testid="schedule-detail"
		>
			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<h2
						id="schedule-title"
						class="font-display text-xl font-semibold wrap-anywhere text-foreground"
					>
						{schedule.name}
					</h2>
					<ScheduleStateBadge {schedule} />
				</div>
				<code
					class="block rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
					>{schedule.command}</code
				>
			</div>

			<dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
				<dt class="text-foreground/70">{SCHEDULE_COPY.whenLabel}</dt>
				<dd class="min-w-0 text-foreground">
					{description ? `${description} ${zone}` : schedule.cron_expression}
					<code class="ml-1 font-mono text-xs text-foreground/70">{schedule.cron_expression}</code>
				</dd>
				<dt class="text-foreground/70">{SCHEDULE_COPY.nextRun}</dt>
				<dd class="text-foreground tabular-nums">
					{schedule.next_run_at
						? formatZonedTime(schedule.next_run_at, schedule.timezone)
						: SCHEDULE_COPY.notScheduled}
				</dd>
				<dt class="text-foreground/70">{SCHEDULE_COPY.timeoutFact}</dt>
				<dd class="text-foreground tabular-nums">
					{SCHEDULE_COPY.seconds(schedule.timeout_seconds)}
				</dd>
			</dl>

			{#if stateView.key === 'paused' && schedule.paused_at}
				<div
					class="flex flex-col gap-3 rounded-control border border-error/30 bg-error-50 p-3 sm:flex-row sm:items-center sm:justify-between"
					data-testid="schedule-paused"
				>
					<p class="flex gap-2 text-sm text-foreground">
						<WarningCircle size={18} class="mt-0.5 shrink-0 text-error-dark" aria-hidden="true" />
						<span
							>{pausedNotice(
								schedule,
								formatZonedTime(schedule.paused_at, schedule.timezone)
							)}</span
						>
					</p>
					{#if !access.readOnly}
						<Button
							variant="secondary"
							size="sm"
							class="shrink-0"
							onclick={() => setEnabled(true)}
							disabled={saveMutation.isPending}
						>
							<Play size={16} aria-hidden="true" />
							{SCHEDULE_COPY.resume}
						</Button>
					{/if}
				</div>
			{/if}

			{#if !access.readOnly}
				<div class="flex flex-wrap items-center gap-2 border-t border-border pt-4">
					<Button
						onclick={runNow}
						disabled={runNowMutation.isPending}
						aria-busy={runNowMutation.isPending}
					>
						<Play size={16} weight="fill" aria-hidden="true" />
						{runNowMutation.isPending ? SCHEDULE_COPY.running : SCHEDULE_COPY.runNow}
					</Button>
					<Button variant="secondary" href={editScheduleHref(projectId, schedule.id)}>
						<PencilSimple size={16} aria-hidden="true" />
						{SCHEDULE_COPY.edit}
					</Button>
					{#if schedule.enabled}
						<Button
							variant="secondary"
							onclick={() => setEnabled(false)}
							disabled={saveMutation.isPending}
						>
							<Pause size={16} aria-hidden="true" />
							{SCHEDULE_COPY.pause}
						</Button>
					{:else if stateView.key !== 'paused'}
						<Button
							variant="secondary"
							onclick={() => setEnabled(true)}
							disabled={saveMutation.isPending}
						>
							<Play size={16} aria-hidden="true" />
							{SCHEDULE_COPY.resume}
						</Button>
					{/if}
					<Button
						variant="ghost"
						class="sm:ml-auto"
						onclick={() => {
							deleteError = '';
							deleteOpen = true;
						}}
					>
						<Trash size={16} aria-hidden="true" />
						{SCHEDULE_COPY.delete}
					</Button>
				</div>
			{:else}
				<p class="border-t border-border pt-4 text-xs text-foreground/70">
					{SCHEDULE_COPY.readOnly}
				</p>
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
			readOnly={access.readOnly}
			{openRunId}
			onToggleLog={toggleLog}
		/>

		<Dialog
			bind:open={deleteOpen}
			title={SCHEDULE_COPY.deleteTitle(schedule.name)}
			description={SCHEDULE_COPY.deleteDescription}
			confirmLabel={SCHEDULE_COPY.delete}
			variant="destructive"
			loading={deleteMutation.isPending}
			onConfirm={confirmDelete}
		>
			{#if deleteError}
				<p role="alert" class="text-sm text-error-dark">{deleteError}</p>
			{/if}
		</Dialog>
	{/if}
</div>
