<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import Moon from 'phosphor-svelte/lib/Moon';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import Button from '$lib/components/ui/Button.svelte';
	import { createProjectMetricsQuery } from '../../monitoring/queries';
	import { hasNoMetrics } from '../../monitoring/chart-data';
	import { emptyTitle, freshnessNote, MONITORING_COPY } from '../../monitoring/format';
	import { metricsRangeOption, resolveMetricsPollInterval } from '../../monitoring/ranges';
	import {
		formatRatio,
		OVERVIEW_METRICS_COPY,
		OVERVIEW_METRICS_RANGE,
		summarizeMetrics
	} from '../../overview/metrics-summary';
	import Sparkline from './Sparkline.svelte';

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
					<div class="skeleton h-6 w-24"></div>
					<div class="skeleton h-8 w-full"></div>
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
		<dl class="grid gap-x-6 gap-y-4 sm:grid-cols-3">
			<div class="flex min-w-0 flex-col gap-1" data-testid="overview-metric-memory">
				<dt class="text-xs font-medium text-muted">{OVERVIEW_METRICS_COPY.memory}</dt>
				<dd class="flex flex-col gap-2">
					<span class="flex flex-wrap items-baseline gap-x-1.5">
						<span class="text-xl font-semibold text-foreground tabular-nums"
							>{summary.memory.value ?? '-'}</span
						>
						<span class="text-xs text-muted">{summary.memory.note}</span>
					</span>
					{#if summary.memory.ratio !== null}
						<!-- A ratio to a limit is a meter; the text above carries both numbers. -->
						<span
							role="meter"
							aria-label="Memori terpakai dari batas"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={Math.round(summary.memory.ratio * 100)}
							aria-valuetext={formatRatio(summary.memory.ratio)}
							class="block h-2 w-full overflow-hidden rounded-full bg-primary-100"
						>
							<span
								class="block h-full rounded-full bg-primary"
								style:width={`${summary.memory.ratio * 100}%`}
							></span>
						</span>
					{/if}
				</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-1" data-testid="overview-metric-cpu">
				<dt class="text-xs font-medium text-muted">{OVERVIEW_METRICS_COPY.cpu}</dt>
				<dd class="flex flex-col gap-1">
					<span class="flex flex-wrap items-baseline gap-x-1.5">
						<span class="text-xl font-semibold text-foreground tabular-nums"
							>{summary.cpu.value ?? '-'}</span
						>
						<span class="text-xs text-muted">{summary.cpu.note}</span>
					</span>
					<Sparkline columns={summary.cpu.sparkline} {xRange} />
				</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-1" data-testid="overview-metric-restarts">
				<dt class="text-xs font-medium text-muted">{OVERVIEW_METRICS_COPY.restarts}</dt>
				<dd class="flex flex-wrap items-baseline gap-x-1.5">
					<span class="text-xl font-semibold text-foreground tabular-nums"
						>{summary.restarts.value}</span
					>
					<span class="text-xs text-muted">{summary.restarts.note}</span>
				</dd>
			</div>
		</dl>
	{/if}
</section>
