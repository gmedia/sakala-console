<script lang="ts">
	import { page } from '$app/state';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ScheduleDetail from '$lib/features/workloads/components/ScheduleDetail.svelte';
	import { createScheduleQuery } from '$lib/features/workloads/queries';
	import { SCHEDULE_COPY } from '$lib/features/workloads/schedules';
	import { pageTitle } from '$lib/utils/page-title';

	const projectId = $derived(page.params.id ?? '');
	const scheduleId = $derived(page.params.scheduleId ?? '');
	const projectQuery = createProjectQuery(() => projectId);
	const scheduleQuery = createScheduleQuery(
		() => projectId,
		() => scheduleId
	);
</script>

<svelte:head
	><title
		>{pageTitle(scheduleQuery.data?.name ?? SCHEDULE_COPY.section, projectQuery.data?.name)}</title
	></svelte:head
>

{#key scheduleId}
	<ScheduleDetail {projectId} {scheduleId} />
{/key}
