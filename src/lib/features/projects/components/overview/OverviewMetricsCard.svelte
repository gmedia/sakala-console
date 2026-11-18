<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import Moon from 'phosphor-svelte/lib/Moon';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import Button from '$lib/components/ui/Button.svelte';
	import { createProjectMetricsQuery } from '../../monitoring/queries';
	import { hasNoMetrics } from '../../monitoring/chart-data';
	import {
		BYTE_AXIS_STEPS,
		COUNT_AXIS_STEPS,
		emptyTitle,
		formatAxisTime,
		formatBytes,
		formatCount,
		formatPercent,
		formatPointTime,
		freshnessNote,
		MONITORING_COPY
	} from '../../monitoring/format';
	import { metricsRangeOption, resolveMetricsPollInterval } from '../../monitoring/ranges';
	import {
		OVERVIEW_METRICS_COPY,
		OVERVIEW_METRICS_RANGE,
		summarizeMetrics,
		type MiniChartId
	} from '../../overview/metrics-summary';
	import type { ChartSeries } from '../monitoring/TimeSeriesChart.svelte';

	type Props = {
		projectId: string;
		runtimeStatus: string;
	};

	let { projectId, runtimeStatus }: Props = $props();

	const monitoringPath = $derived(
		resolveRoute('/(app)/projects/[id]/monitoring', { id: projectId })
	);
	const NOT_DEPLOYED = 'not_deployed';
	const SLEEPING = 'sleeping';
	/** Small enough for three side by side, tall enough for two value ticks. */
	const MINI_CHART_HEIGHT = 112;

	// A project that never ran has no samples, so the overview does not spend a request finding out.
	const hasRun = $derived(runtimeStatus !== NOT_DEPLOYED);
	const metricsQuery = createProjectMetricsQuery(
		() => projectId,
		() => OVERVIEW_METRICS_RANGE,
		() => runtimeStatus,
		() => ({ enabled: hasRun })
	);

	const rangeOption = metricsRangeOption(OVERVIEW_METRICS_RANGE);
	const metrics = $derived(metricsQuery.data);
	const summary = $derived(metrics && !hasNoMetrics(metrics) ? summarizeMetrics(metrics) : null);
	const xRange = $derived.by((): [number, number] => {
		const end = Math.floor(metricsQuery.dataUpdatedAt / 1_000);
		return [end - rangeOption.seconds, end];
	});
	const polls = $derived(
		resolveMetricsPollInterval(OVERVIEW_METRICS_RANGE, runtimeStatus) !== false
	);
	const freshness = $derived(
		metricsQuery.dataUpdatedAt > 0 ? freshnessNote(metricsQuery.dataUpdatedAt, polls) : null
	);

	const { average, peak, limit } = MONITORING_COPY.series;
	/** The same lines as the Metrik tab's charts, so a shape here is the shape there. */
	const SERIES: Record<MiniChartId, ChartSeries[]> = {
		memory: [
			{ label: average, tone: 'primary' },
			{ label: peak, tone: 'soft' },
			{ label: limit, tone: 'reference', dashed: true }
		],
		cpu: [
			{ label: average, tone: 'primary' },
			{ label: peak, tone: 'soft' }
		],
		replicas: [{ label: MONITORING_COPY.series.replicas, tone: 'primary', kind: 'step' }]
	};
	const FORMAT: Record<MiniChartId, (value: number) => string> = {
		memory: formatBytes,
		cpu: formatPercent,
		replicas: formatCount
	};
	const INCREMENTS: Partial<Record<MiniChartId, readonly number[]>> = {
		memory: BYTE_AXIS_STEPS,
		replicas: COUNT_AXIS_STEPS
	};
	const STAT_BAND: [number, number] = [1, 0];
	const axisTime = (seconds: number) => formatAxisTime(seconds, rangeOption);

	/**
	 * uPlot loads with its own chunk, after the numbers are on screen, so the overview's first paint
	 * never waits for it. The Metrik tab shares the same chunk.
	 */
	const loadChart = () => import('../monitoring/TimeSeriesChart.svelte');
</script>

<section
	aria-labelledby="overview-metrics-title"
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	data-testid="overview-metrics"
>
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<div class="flex min-w-0 flex-col gap-0.5">
			<h2 id="overview-metrics-title" class="text-base text-foreground">
				{OVERVIEW_METRICS_COPY.title}
			</h2>
			{#if freshness && summary}
				<p class="text-xs text-muted">{freshness}</p>
			{/if}
		</div>
		<a
			href={monitoringPath}
			class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
		>
			{OVERVIEW_METRICS_COPY.link}
		</a>
	</div>

	{#if runtimeStatus === SLEEPING && hasRun}
		<p class="flex items-start gap-2 text-sm text-foreground">
			<Moon size={20} class="mt-px shrink-0 text-muted" aria-hidden="true" />
			{MONITORING_COPY.sleeping}
		</p>
	{/if}

	{#if !hasRun}
		<p class="text-sm text-muted">{OVERVIEW_METRICS_COPY.notRunning}</p>
	{:else if metricsQuery.isPending}
		<div class="grid gap-4 sm:grid-cols-3" role="status">
			<span class="sr-only">{MONITORING_COPY.loading}</span>
			{#each [1, 2, 3] as item (item)}
				<div class="flex flex-col gap-2" aria-hidden="true">
					<div class="skeleton h-4 w-16"></div>
					<div class="skeleton h-4 w-32"></div>
					<div class="skeleton h-28 w-full"></div>
				</div>
			{/each}
		</div>
	{:else if metricsQuery.isError}
		<div role="alert" class="flex flex-wrap items-center gap-3 text-error">
			<WarningCircle size={20} weight="fill" aria-hidden="true" />
			<p class="min-w-0 flex-1 text-sm font-medium">{MONITORING_COPY.error}</p>
			<Button
				variant="secondary"
				size="sm"
				onclick={() => metricsQuery.refetch()}
				disabled={metricsQuery.isFetching}
			>
				{metricsQuery.isFetching ? MONITORING_COPY.retrying : MONITORING_COPY.retry}
			</Button>
		</div>
	{:else if !summary}
		<div class="flex flex-col gap-1" data-testid="overview-metrics-empty">
			<p class="text-sm font-medium text-foreground">{emptyTitle(rangeOption)}.</p>
			<p class="text-sm text-muted">{MONITORING_COPY.empty.description}</p>
		</div>
	{:else}
		<div class="@container">
			<div class="grid gap-x-6 gap-y-5 @xl:grid-cols-3">
				{#each summary.charts as chart (chart.id)}
					<figure
						class="m-0 flex min-w-0 flex-col gap-1"
						aria-labelledby={`overview-chart-${chart.id}-title`}
						aria-describedby={`overview-chart-${chart.id}-summary`}
						data-testid={`overview-chart-${chart.id}`}
					>
						<figcaption class="flex flex-col gap-0.5">
							<span class="flex items-baseline justify-between gap-2">
								<h3
									id={`overview-chart-${chart.id}-title`}
									class="text-sm font-semibold text-foreground"
								>
									{chart.title}
								</h3>
								{#if chart.peak}
									<span class="text-xs font-medium text-foreground tabular-nums">{chart.peak}</span>
								{/if}
							</span>
							<span id={`overview-chart-${chart.id}-summary`} class="text-xs text-muted"
								>{chart.latest}</span
							>
						</figcaption>
						{#if chart.hasData}
							<div style:min-height={`${MINI_CHART_HEIGHT}px`}>
								{#await loadChart()}
									<div
										class="skeleton w-full"
										style:height={`${MINI_CHART_HEIGHT}px`}
										aria-hidden="true"
									></div>
								{:then { default: TimeSeriesChart }}
									<TimeSeriesChart
										columns={chart.columns}
										series={SERIES[chart.id]}
										band={chart.id === 'replicas' ? undefined : STAT_BAND}
										increments={INCREMENTS[chart.id]}
										{xRange}
										formatValue={FORMAT[chart.id]}
										formatAxisTime={axisTime}
										{formatPointTime}
										height={MINI_CHART_HEIGHT}
										legend={false}
										compact
									/>
								{/await}
							</div>
						{/if}
					</figure>
				{/each}
			</div>
		</div>
		<p class="text-sm text-foreground" data-testid="overview-restarts">{summary.restarts}</p>
	{/if}
</section>
