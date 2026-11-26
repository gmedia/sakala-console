<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import { RadioGroup } from 'bits-ui';
	import ChartLine from 'phosphor-svelte/lib/ChartLine';
	import Moon from 'phosphor-svelte/lib/Moon';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import EmptyState from '$lib/components/feedback/EmptyState.svelte';
	import ListPageLayout from '$lib/components/layout/templates/ListPageLayout.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		PROJECT_METRICS_RANGES,
		type ProjectMetricsRange
	} from '$lib/api/resources/project-metrics';
	import { createProjectQuery } from '../../queries';
	import {
		createDeploymentMarkersQuery,
		createProjectMetricsQuery
	} from '../../monitoring/queries';
	import {
		METRICS_RANGE_OPTIONS,
		defaultMetricsRange,
		metricsRangeOption,
		projectAgeSeconds,
		rangeCoversProjectLife,
		resolveMetricsPollInterval
	} from '../../monitoring/ranges';
	import {
		cpuChart,
		hasNoMetrics,
		hasPoints,
		lateDataStart,
		memoryChart,
		replicasChart,
		restartsChart
	} from '../../monitoring/chart-data';
	import {
		MARKER_MAX_PAGES,
		MARKER_PAGE_SIZE,
		deploymentMarkers
	} from '../../monitoring/deployment-markers';
	import {
		BYTE_AXIS_STEPS,
		COUNT_AXIS_STEPS,
		MONITORING_COPY,
		cpuSummary,
		dataStartNote,
		deploymentLabel,
		emptyTitle,
		formatAxisTime,
		freshnessNote,
		widenRangeLabel,
		formatBytes,
		formatCount,
		formatPercent,
		formatPointTime,
		memoryLimitNote,
		memorySummary,
		replicasSummary,
		restartsSummary
	} from '../../monitoring/format';
	import MetricCard from './MetricCard.svelte';
	import TimeSeriesChart, { type ChartMarker, type ChartSeries } from './TimeSeriesChart.svelte';

	type Props = {
		projectId: string;
		/**
		 * The range picked, bound by the route to the query string so it can be shared and walked
		 * back. `null` until someone picks one: the tab then opens on a range that fits the project's age.
		 */
		range?: ProjectMetricsRange | null;
	};

	let { projectId, range = $bindable(null) }: Props = $props();

	const SLEEPING_STATUS = 'sleeping';
	const LONGEST_RANGE = METRICS_RANGE_OPTIONS[METRICS_RANGE_OPTIONS.length - 1];
	/** Read once: the range a page opens on should not change under someone who keeps it open. */
	const openedAt = Date.now();

	const projectQuery = createProjectQuery(() => projectId);
	const runtimeStatus = $derived(projectQuery.data?.runtime_status);
	const projectAge = $derived(projectAgeSeconds(projectQuery.data?.created_at, openedAt));
	const fittingRange = $derived(defaultMetricsRange(projectAge));
	const currentRange = $derived(range ?? fittingRange);
	// Without a picked range, wait for the project's age, so a new project does not read a day first.
	const rangeKnown = $derived(
		range !== null || projectQuery.data !== undefined || projectQuery.isError
	);
	const metricsQuery = createProjectMetricsQuery(
		() => projectId,
		() => currentRange,
		() => runtimeStatus,
		() => ({ enabled: rangeKnown })
	);
	const markersQuery = createDeploymentMarkersQuery(
		() => projectId,
		() => currentRange,
		() => runtimeStatus,
		() => ({ enabled: rangeKnown })
	);

	const rangeOption = $derived(metricsRangeOption(currentRange));
	const sleeping = $derived(runtimeStatus === SLEEPING_STATUS);
	const metrics = $derived(metricsQuery.data);

	const cpu = $derived(metrics ? cpuChart(metrics) : null);
	const memory = $derived(metrics ? memoryChart(metrics) : null);
	const replicas = $derived(metrics ? replicasChart(metrics) : null);
	const restarts = $derived(metrics ? restartsChart(metrics) : null);

	/** The window ends when the answer arrived, so the newest bucket sits at the right edge. */
	const xRange = $derived.by((): [number, number] => {
		const end = Math.floor(metricsQuery.dataUpdatedAt / 1_000);
		return [end - rangeOption.seconds, end];
	});
	const axisTime = (seconds: number) => formatAxisTime(seconds, rangeOption);
	const polls = $derived(resolveMetricsPollInterval(currentRange, runtimeStatus) !== false);
	const dataStart = $derived(metrics ? lateDataStart(metrics, xRange[0]) : null);
	// A project younger than the range has nothing older to show in a wider one.
	const canWiden = $derived(
		currentRange !== LONGEST_RANGE.value && !rangeCoversProjectLife(rangeOption, projectAge)
	);

	const markers = $derived(
		deploymentMarkers(markersQuery.data?.deployments ?? [], xRange).map((marker) => ({
			...marker,
			chart: {
				t: marker.t,
				title: deploymentLabel(marker.sequence),
				detail: marker.title ?? MONITORING_COPY.markers.manual,
				time: formatPointTime(marker.t)
			} satisfies ChartMarker
		}))
	);
	const chartMarkers = $derived(markers.map((marker) => marker.chart));
	const markersPartial = $derived(markersQuery.data?.complete === false);

	const freshness = $derived(
		metricsQuery.dataUpdatedAt > 0 ? freshnessNote(metricsQuery.dataUpdatedAt, polls) : null
	);

	const { average, peak, limit } = MONITORING_COPY.series;
	const CPU_SERIES: ChartSeries[] = [
		{ label: average, tone: 'primary' },
		{ label: peak, tone: 'soft' }
	];
	const MEMORY_SERIES: ChartSeries[] = [
		...CPU_SERIES,
		{ label: limit, tone: 'reference', dashed: true }
	];
	const REPLICAS_SERIES: ChartSeries[] = [
		{ label: MONITORING_COPY.series.replicas, tone: 'primary', kind: 'step' }
	];
	const RESTARTS_SERIES: ChartSeries[] = [
		{ label: MONITORING_COPY.series.restarts, tone: 'primary', kind: 'bars' }
	];
	const STAT_BAND: [number, number] = [1, 0];

	/** The fitting range stays out of the address, so a shared link keeps fitting the project. */
	function pickRange(next: ProjectMetricsRange) {
		range = next === fittingRange ? null : next;
	}

	function selectRange(next: string) {
		if ((PROJECT_METRICS_RANGES as readonly string[]).includes(next)) {
			pickRange(next as ProjectMetricsRange);
		}
	}
</script>

{#snippet toolbar()}
	<!-- When the charts were read on the left, the range on the right; the tab names what they show. -->
	{#if freshness}
		<p class="text-xs text-muted" data-testid="metrics-freshness">{freshness}</p>
	{:else}
		<span aria-hidden="true"></span>
	{/if}
	<RadioGroup.Root
		value={currentRange}
		onValueChange={selectRange}
		orientation="horizontal"
		aria-label={MONITORING_COPY.rangeLabel}
		class="grid w-full grid-cols-5 rounded-control border border-border-strong bg-surface p-0.5 sm:inline-flex sm:w-auto"
	>
		{#each METRICS_RANGE_OPTIONS as option (option.value)}
			<RadioGroup.Item
				value={option.value}
				class="min-h-control-lg rounded-control px-1 text-sm font-medium whitespace-nowrap text-muted transition-colors hover:text-foreground data-[state=checked]:bg-primary data-[state=checked]:text-white sm:min-h-control-sm sm:px-3"
			>
				{option.label}
			</RadioGroup.Item>
		{/each}
	</RadioGroup.Root>
{/snippet}

<!-- The list template: the charts across the full width, under one toolbar. -->
<ListPageLayout {toolbar}>
	{#if sleeping}
		<p
			class="flex items-start gap-2 rounded-control border border-border bg-surface px-4 py-3 text-sm text-foreground"
		>
			<Moon size={20} class="mt-px shrink-0 text-muted" aria-hidden="true" />
			{MONITORING_COPY.sleeping}
		</p>
	{/if}

	{#if metricsQuery.isPending}
		<div class="grid gap-4 md:grid-cols-2" role="status">
			<span class="sr-only">{MONITORING_COPY.loading}</span>
			{#each [1, 2, 3, 4] as item (item)}
				<div class="surface-card flex flex-col gap-3 p-4" aria-hidden="true">
					<div class="skeleton h-5 w-24"></div>
					<div class="skeleton h-4 w-3/4"></div>
					<div class="skeleton h-40 w-full"></div>
				</div>
			{/each}
		</div>
	{:else if metricsQuery.isError}
		<div
			role="alert"
			class="flex flex-wrap items-center gap-3 rounded-card border border-error/20 bg-error/5 p-4 text-error"
		>
			<WarningCircle size={24} weight="fill" aria-hidden="true" />
			<p class="min-w-0 flex-1 text-sm font-medium">{MONITORING_COPY.error}</p>
			<Button
				variant="secondary"
				onclick={() => metricsQuery.refetch()}
				disabled={metricsQuery.isFetching}
			>
				{metricsQuery.isFetching ? MONITORING_COPY.retrying : MONITORING_COPY.retry}
			</Button>
		</div>
	{:else if metrics && hasNoMetrics(metrics)}
		<EmptyState
			icon={ChartLine}
			tone="muted"
			title={emptyTitle(rangeOption)}
			description={MONITORING_COPY.empty.description}
		>
			{#snippet action()}
				{#if canWiden}
					<Button variant="secondary" onclick={() => pickRange(LONGEST_RANGE.value)}>
						{widenRangeLabel(LONGEST_RANGE)}
					</Button>
				{/if}
			{/snippet}
		</EmptyState>
	{:else if cpu && memory && replicas && restarts}
		{#if dataStart !== null}
			<p class="text-sm text-foreground" data-testid="metrics-data-start">
				{dataStartNote(dataStart)}
			</p>
		{/if}
		<div class="grid gap-4 md:grid-cols-2">
			<MetricCard
				id="memory"
				title={MONITORING_COPY.titles.memory}
				summary={memorySummary(memory, rangeOption)}
				note={memoryLimitNote(memory)}
				hasData={hasPoints(memory.columns)}
			>
				{#snippet chart()}
					<TimeSeriesChart
						columns={memory.columns}
						series={MEMORY_SERIES}
						band={STAT_BAND}
						{xRange}
						formatValue={formatBytes}
						increments={BYTE_AXIS_STEPS}
						formatAxisTime={axisTime}
						{formatPointTime}
						markers={chartMarkers}
					/>
				{/snippet}
			</MetricCard>
			<MetricCard
				id="cpu"
				title={MONITORING_COPY.titles.cpu}
				summary={cpuSummary(cpu, rangeOption)}
				learnMore={MONITORING_COPY.cpuNote}
				hasData={hasPoints(cpu.columns)}
			>
				{#snippet chart()}
					<TimeSeriesChart
						columns={cpu.columns}
						series={CPU_SERIES}
						band={STAT_BAND}
						{xRange}
						formatValue={formatPercent}
						formatAxisTime={axisTime}
						{formatPointTime}
						markers={chartMarkers}
					/>
				{/snippet}
			</MetricCard>
			<MetricCard
				id="restarts"
				title={MONITORING_COPY.titles.restarts}
				summary={restartsSummary(restarts, rangeOption)}
				learnMore={MONITORING_COPY.restartsNote}
				hasData={hasPoints(restarts.columns)}
			>
				{#snippet chart()}
					<TimeSeriesChart
						columns={restarts.columns}
						series={RESTARTS_SERIES}
						increments={COUNT_AXIS_STEPS}
						{xRange}
						formatValue={formatCount}
						formatAxisTime={axisTime}
						{formatPointTime}
						markers={chartMarkers}
					/>
				{/snippet}
			</MetricCard>
			<MetricCard
				id="replicas"
				title={MONITORING_COPY.titles.replicas}
				summary={replicasSummary(replicas, rangeOption)}
				hasData={hasPoints(replicas.columns)}
			>
				{#snippet chart()}
					<TimeSeriesChart
						columns={replicas.columns}
						series={REPLICAS_SERIES}
						increments={COUNT_AXIS_STEPS}
						{xRange}
						formatValue={formatCount}
						formatAxisTime={axisTime}
						{formatPointTime}
						markers={chartMarkers}
					/>
				{/snippet}
			</MetricCard>
		</div>
		{#if markers.length > 0}
			<!-- The markers as text: the canvas says nothing to a screen reader or a keyboard. -->
			<section
				aria-labelledby="deployment-markers-title"
				class="surface-card flex min-w-0 flex-col gap-2 p-4"
				data-testid="deployment-markers"
			>
				<h2 id="deployment-markers-title" class="font-sans text-base font-semibold text-foreground">
					{MONITORING_COPY.markers.title}
				</h2>
				<p class="flex items-center gap-2 text-xs text-muted">
					<span class="h-3 w-px shrink-0 bg-muted" aria-hidden="true"></span>
					{MONITORING_COPY.markers.key}
				</p>
				<ul class="flex flex-col">
					{#each markers.toReversed() as marker (marker.deploymentId)}
						<li class="flex min-w-0 flex-wrap items-baseline gap-x-2 py-1 text-sm">
							<a
								href={resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
									id: projectId,
									deploymentId: marker.deploymentId
								})}
								class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
							>
								{marker.chart.title}
							</a>
							<span class="text-xs whitespace-nowrap text-muted">{marker.chart.time}</span>
							<span
								class="min-w-0 basis-full truncate text-foreground sm:flex-1 sm:basis-auto"
								title={marker.chart.detail}
							>
								{marker.chart.detail}
							</span>
						</li>
					{/each}
				</ul>
				{#if markersPartial}
					<p class="text-xs text-muted">
						{MONITORING_COPY.markers.partial(MARKER_MAX_PAGES * MARKER_PAGE_SIZE)}
					</p>
				{/if}
			</section>
		{/if}
	{/if}
</ListPageLayout>
