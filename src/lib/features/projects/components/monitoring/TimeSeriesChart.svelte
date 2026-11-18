<script lang="ts" module>
	/** Where a series takes its colour from: a token class, read back from the DOM for the canvas. */
	export type ChartTone = 'primary' | 'soft' | 'reference';

	export type ChartSeries = {
		label: string;
		tone: ChartTone;
		/** `line` by default; `step` holds a value until the next point, `bars` draws one per bucket. */
		kind?: 'line' | 'step' | 'bars';
		/** A reference line rather than data, such as a limit. */
		dashed?: boolean;
	};
</script>

<script lang="ts">
	import uPlot from 'uplot';
	import 'uplot/dist/uPlot.min.css';
	import type { AlignedColumns } from '../../monitoring/chart-data';
	import { MONITORING_COPY } from '../../monitoring/format';

	type Props = {
		columns: AlignedColumns;
		series: readonly ChartSeries[];
		/** The whole window, in Unix seconds, so a short stretch of data is not stretched across it. */
		xRange: [number, number];
		formatValue: (value: number) => string;
		formatAxisTime: (seconds: number) => string;
		formatPointTime: (seconds: number) => string;
		/** Fill between two series, by index in `series`: the upper edge, then the lower one. */
		band?: [upper: number, lower: number];
		/** The steps the value axis may tick at, such as whole numbers for counts. uPlot picks otherwise. */
		increments?: readonly number[];
		height?: number;
		/** The readout under the chart. Off for small charts whose card states the numbers. */
		legend?: boolean;
		/** Fewer, wider-spaced ticks and no cursor, for a small chart that only shows the shape. */
		compact?: boolean;
	};

	let {
		columns,
		series,
		xRange,
		formatValue,
		formatAxisTime,
		formatPointTime,
		band,
		increments,
		height = 160,
		legend = true,
		compact = false
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let palette: HTMLDivElement | undefined = $state();

	const LINE_WIDTH = { primary: 2, soft: 1.5, reference: 1.5 } as const;
	const REFERENCE_DASH = [6, 4];
	/** Share of a bucket, widest, and narrowest in px, so a single restart in a long range stays visible. */
	const BAR_SIZE: [factor: number, max: number, min: number] = [0.7, 24, 2];
	/** Room for the newest value above the highest point. */
	const HEADROOM = 1.15;
	const AXIS_FONT_SIZE_PX = 12;
	/** Space between a value label and the plot, past the tick. */
	const AXIS_LABEL_GAP_PX = 8;
	const NO_VALUE = '–';
	/** Least room between ticks on a compact chart, in px: about three times and two values. */
	const COMPACT_TICK_SPACE = { x: 48, y: 28 } as const;

	/** The design tokens as colours the canvas understands, read off the hidden swatches below. */
	function readPalette(root: HTMLElement) {
		const colour = (name: string) =>
			getComputedStyle(root.querySelector(`[data-tone="${name}"]`) as Element).color;
		return {
			primary: colour('primary'),
			soft: colour('soft'),
			band: colour('band'),
			reference: colour('reference'),
			axis: colour('axis'),
			grid: colour('grid'),
			font: `${AXIS_FONT_SIZE_PX}px ${getComputedStyle(root).fontFamily}`
		};
	}

	function pathsOf(kind: ChartSeries['kind']): uPlot.Series.PathBuilder | undefined {
		if (kind === 'step') return uPlot.paths.stepped?.({ align: 1 });
		if (kind === 'bars') return uPlot.paths.bars?.({ size: BAR_SIZE, align: 0 });
		return undefined;
	}

	/** As wide as the longest label, which uPlot does not measure for a custom formatter. */
	const axisSize: uPlot.Axis.Size = (plot, values, axisIndex, cycle) => {
		const axis = plot.axes[axisIndex];
		if (cycle > 1) return (axis as { _size?: number })._size ?? 0;
		const longest = (values ?? []).reduce((a, b) => (b.length > a.length ? b : a), '');
		plot.ctx.font = String(axis.font?.[0] ?? '');
		const text = longest ? plot.ctx.measureText(longest).width / devicePixelRatio : 0;
		return Math.ceil((axis.ticks?.size ?? 0) + AXIS_LABEL_GAP_PX + text);
	};

	/**
	 * Off the plot the readout shows the newest point, so it says something before anyone hovers;
	 * over it, the point under the cursor, and a dash where that point is missing.
	 */
	function readout(format: (value: number) => string): uPlot.Series.Value {
		return (plot, value, seriesIndex, index) => {
			if (index != null) return value == null ? NO_VALUE : format(value);
			const values = plot.data[seriesIndex] as (number | null)[];
			for (let i = values.length - 1; i >= 0; i--) {
				const current = values[i];
				if (current != null) return format(current);
			}
			return NO_VALUE;
		};
	}

	/** The time of the newest point any series has, which a gap row at the end would not be. */
	function newestTime(plot: uPlot): number | null {
		const times = plot.data[0];
		for (let i = times.length - 1; i >= 0; i--) {
			if (plot.data.slice(1).some((values) => values[i] != null)) return times[i];
		}
		return null;
	}

	function options(width: number, colours: ReturnType<typeof readPalette>): uPlot.Options {
		const axis = {
			stroke: colours.axis,
			font: colours.font,
			grid: { stroke: colours.grid, width: 1 },
			ticks: { stroke: colours.grid, width: 1 }
		};
		return {
			width,
			height,
			cursor: compact ? { show: false } : { points: { size: 8 }, drag: { x: false, y: false } },
			legend: { show: legend, live: legend },
			scales: {
				x: { time: true, range: () => xRange },
				y: {
					range: (_plot, _min, max) => {
						const top = Math.max(max ?? 0, 0) * HEADROOM;
						return [0, top > 0 ? top : 1];
					}
				}
			},
			axes: [
				{
					...axis,
					space: compact ? COMPACT_TICK_SPACE.x : undefined,
					values: (_plot, splits) => splits.map((seconds) => formatAxisTime(seconds))
				},
				{
					...axis,
					space: compact ? COMPACT_TICK_SPACE.y : undefined,
					size: axisSize,
					incrs: increments ? [...increments] : undefined,
					values: (_plot, splits) => splits.map((value) => formatValue(value))
				}
			],
			series: [
				{
					label: MONITORING_COPY.series.time,
					value: (plot, seconds, _series, index) => {
						const time = index == null ? newestTime(plot) : seconds;
						return time == null ? NO_VALUE : formatPointTime(time);
					}
				},
				...series.map((item): uPlot.Series => ({
					label: item.label,
					stroke: colours[item.tone],
					width: LINE_WIDTH[item.tone],
					dash: item.dashed ? REFERENCE_DASH : undefined,
					fill: item.kind === 'bars' ? colours[item.tone] : undefined,
					paths: pathsOf(item.kind),
					points: { show: false },
					spanGaps: false,
					value: readout(formatValue)
				}))
			],
			bands: band ? [{ series: [band[0] + 1, band[1] + 1], fill: colours.band }] : undefined
		};
	}

	$effect(() => {
		if (!container || !palette) return;
		const target = container;
		const plot = new uPlot(
			options(target.clientWidth, readPalette(palette)),
			columns as uPlot.AlignedData,
			target
		);
		const observer = new ResizeObserver(() => plot.setSize({ width: target.clientWidth, height }));
		observer.observe(target);
		return () => {
			observer.disconnect();
			plot.destroy();
		};
	});
</script>

<!-- The canvas says nothing to a screen reader; the card's summary carries the numbers instead. -->
<div class="time-series-chart" aria-hidden="true">
	<!-- Every line holds 3:1 on the card (WCAG 1.4.11). The band between average and peak is decoration. -->
	<div bind:this={palette} class="hidden">
		<span data-tone="primary" class="text-primary"></span>
		<span data-tone="soft" class="text-primary-400"></span>
		<span data-tone="band" class="text-primary-50"></span>
		<span data-tone="reference" class="text-border-strong"></span>
		<span data-tone="axis" class="text-muted"></span>
		<span data-tone="grid" class="text-border"></span>
	</div>
	<div bind:this={container} class="w-full"></div>
</div>

<style>
	/* uPlot's legend doubles as the readout under the cursor. Tokens, not its default type. */
	.time-series-chart :global(.u-legend) {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		line-height: var(--text-xs--line-height);
		color: var(--color-muted);
		text-align: left;
	}

	/* Clicking a legend entry would hide its series, which nothing else on the page explains. */
	.time-series-chart :global(.u-legend .u-series) {
		pointer-events: none;
	}

	.time-series-chart :global(.u-legend .u-value) {
		color: var(--color-foreground);
		font-variant-numeric: tabular-nums;
	}

	.time-series-chart :global(.u-legend .u-series) {
		padding: 0.25rem 0.5rem 0 0;
	}

	.time-series-chart :global(.u-legend .u-series > *) {
		padding: 0 0.25rem 0 0;
	}
</style>
