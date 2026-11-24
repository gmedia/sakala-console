<script lang="ts">
	import { page } from '$app/state';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ScheduleFormPage from '$lib/features/workloads/components/ScheduleFormPage.svelte';
	import { SCHEDULE_COPY } from '$lib/features/workloads/schedules';
	import { pageTitle } from '$lib/utils/page-title';

	const projectId = $derived(page.params.id ?? '');
	const projectQuery = createProjectQuery(() => projectId);
</script>

<svelte:head
	><title>{pageTitle(SCHEDULE_COPY.createTitle, projectQuery.data?.name)}</title></svelte:head
>

<ScheduleFormPage {projectId} />
