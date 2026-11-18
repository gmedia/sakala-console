<script lang="ts">
	import { createProjectQuery } from '$lib/features/projects/queries';
	import { pageTitle } from '$lib/utils/page-title';
	import { page } from '$app/stores';
	import { useListUrl } from '$lib/features/admin/list-url.svelte';
	import MonitoringTab from '$lib/features/projects/components/monitoring/MonitoringTab.svelte';
	import { MONITORING_COPY } from '$lib/features/projects/monitoring/format';
	import {
		DEFAULT_METRICS_RANGE,
		METRICS_RANGE_PARAM,
		readMetricsRange
	} from '$lib/features/projects/monitoring/ranges';
	import type { ProjectMetricsRange } from '$lib/api/resources/project-metrics';

	let projectId = $derived($page.params.id as string);
	const projectQuery = createProjectQuery(() => projectId);

	// The range lives in the query string, like the admin lists' filters: shareable, and Back undoes it.
	const url = useListUrl();
	const range = $derived(readMetricsRange(url.search));
	const setRange = (next: ProjectMetricsRange) =>
		url.update({ [METRICS_RANGE_PARAM]: next === DEFAULT_METRICS_RANGE ? null : next });
</script>

<svelte:head><title>{pageTitle(MONITORING_COPY.tab, projectQuery.data?.name)}</title></svelte:head>

<MonitoringTab {projectId} bind:range={() => range, setRange} />
