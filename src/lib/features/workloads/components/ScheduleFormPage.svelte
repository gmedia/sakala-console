<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import type { ProjectSchedule } from '$lib/api/resources/schedules';
	import ErrorBlock from '$lib/components/feedback/ErrorBlock.svelte';
	import FocusedPageLayout from '$lib/components/layout/templates/FocusedPageLayout.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import { useWorkloadAvailability } from '../availability.svelte';
	import { createScheduleQuery } from '../queries';
	import { LARAVEL_SUGGESTION, scheduleHref, schedulesHref, SUGGESTION_PARAM } from '../routes';
	import { SCHEDULE_COPY, scheduleLimits } from '../schedules';
	import ScheduleForm from './ScheduleForm.svelte';

	type Props = {
		projectId: string;
		/** The schedule to change; without it the page creates one. */
		scheduleId?: string;
	};

	let { projectId, scheduleId = '' }: Props = $props();

	const projectQuery = createProjectQuery(() => projectId);
	const access = useProjectAccess(() => projectQuery.data);
	const workloads = useWorkloadAvailability(() => projectQuery.data);
	const scheduleQuery = createScheduleQuery(
		() => projectId,
		() => scheduleId
	);

	const editing = $derived(Boolean(scheduleId));
	const limits = $derived(scheduleLimits(workloads.limits));
	const ready = $derived(
		Boolean(projectQuery.data) &&
			Boolean(workloads.limits) &&
			(!editing || Boolean(scheduleQuery.data))
	);
	const laravelSuggestion = $derived(
		page.url.searchParams.get(SUGGESTION_PARAM) === LARAVEL_SUGGESTION
	);
	const cancelHref = $derived(
		editing ? scheduleHref(projectId, scheduleId) : schedulesHref(projectId)
	);
	const failed = $derived(projectQuery.isError || (editing && scheduleQuery.isError));

	async function handleSaved(schedule: ProjectSchedule, created: boolean) {
		toast.success(
			created ? SCHEDULE_COPY.created(schedule.name) : SCHEDULE_COPY.updated(schedule.name)
		);
		await goto(scheduleHref(projectId, schedule.id));
	}
</script>

<!-- One form, one button: the focused template, centred. -->
<FocusedPageLayout>
	<!-- eslint-disable svelte/no-navigation-without-resolve -- resolved, plus an anchor -->
	<a
		href={editing ? scheduleHref(projectId, scheduleId) : schedulesHref(projectId)}
		class="inline-flex min-h-control-sm w-fit items-center gap-1.5 rounded-control text-sm font-medium text-foreground/70 hover:text-foreground max-lg:min-h-control-lg"
	>
		<ArrowLeft size={16} aria-hidden="true" />
		{editing ? (scheduleQuery.data?.name ?? SCHEDULE_COPY.section) : SCHEDULE_COPY.backToSettings}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	{#if failed}
		<ErrorBlock
			icon={CalendarBlank}
			title={SCHEDULE_COPY.loadFailed}
			description={SCHEDULE_COPY.notFound}
			links={[{ label: SCHEDULE_COPY.backToSettings, href: schedulesHref(projectId) }]}
		/>
	{:else if !ready}
		<div class="skeleton h-96 w-full" role="status" aria-label="Memuat formulir jadwal"></div>
	{:else if access.readOnly || !workloads.schedules}
		<ErrorBlock
			icon={CalendarBlank}
			title={access.readOnly ? SCHEDULE_COPY.readOnly : SCHEDULE_COPY.unavailable}
			links={[{ label: SCHEDULE_COPY.backToSettings, href: schedulesHref(projectId) }]}
		/>
	{:else}
		<section
			class="surface-card flex flex-col gap-5 p-4 sm:p-6"
			aria-labelledby="schedule-form-title"
		>
			<div>
				<h2 id="schedule-form-title" class="font-display text-xl font-semibold text-foreground">
					{editing ? SCHEDULE_COPY.editTitle : SCHEDULE_COPY.createTitle}
				</h2>
				<p class="mt-1 text-sm text-foreground/70">{SCHEDULE_COPY.intro}</p>
			</div>
			<ScheduleForm
				{projectId}
				{limits}
				schedule={scheduleQuery.data ?? null}
				{laravelSuggestion}
				{cancelHref}
				onSaved={handleSaved}
			/>
		</section>
	{/if}
</FocusedPageLayout>
