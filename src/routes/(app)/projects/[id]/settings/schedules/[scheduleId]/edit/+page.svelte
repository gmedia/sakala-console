<script lang="ts">
	import { page } from '$app/state';
	import ScheduleFormPage from '$lib/features/workloads/components/ScheduleFormPage.svelte';
	import { SCHEDULE_COPY } from '$lib/features/workloads/schedules';
	import { pageTitle } from '$lib/utils/page-title';

	const projectId = $derived(page.params.id ?? '');
	const scheduleId = $derived(page.params.scheduleId ?? '');
</script>

<svelte:head><title>{pageTitle(SCHEDULE_COPY.editTitle)}</title></svelte:head>

{#key scheduleId}
	<ScheduleFormPage {projectId} {scheduleId} />
{/key}
