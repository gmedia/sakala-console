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

	/** An event on the time axis, drawn as a vertical line, such as a deployment going live. */
	export type ChartMarker = {
		/** Unix seconds. */
		t: number;
		/** What the tooltip leads with: `Deployment #12`. */
		title: string;
		/** The line under it, such as the commit message. */
		detail: string;
		/** When it happened, in words: `23 Nov 14.30`. */
		time: string;
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
		/** Vertical lines at these times, with a tooltip under the cursor. Not on a compact chart. */
		markers?: readonly ChartMarker[];
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
		compact = false,
		markers = []
	}: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let palette: HTMLDivElement | undefined = $state();
	/** The marker under the cursor, and where its line is, in px from the chart's left edge. */
	let hovered: { marker: ChartMarker; x: number; top: number; alignRight: boolean } | null =
		$state(null);

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
	/** A marker is a hairline in the event ink, with a cap so it never reads as a grid line. */
	const MARKER_LINE_WIDTH_PX = 1;
	const MARKER_CAP_RADIUS_PX = 4;
	/** Half the hover target: 24 px wide around a 1 px line, so nobody has to land on the line. */
	const MARKER_HIT_PX = 12;
	/** Room between the line and its tooltip. */
	const TOOLTIP_OFFSET_PX = 8;

	/** The design tokens as colours the canvas understands, read off the hidden swatches below. */
	function readPalette(root: HTMLElement) {
		const colour = (name: string) =>
			getComputedStyle(root.querySelector(`[data-tone="${name}"]`) as Element).color;
		return {
			primary: colour('primary'),
			soft: colour('soft'),
			band: colour('band'),
			reference: colour('reference'),
			marker: colour('marker'),
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

	/** The markers inside the visible window, with their x in CSS px from the plot's left edge. */
	function visibleMarkers(plot: uPlot, list: readonly ChartMarker[]) {
		const { min, max } = plot.scales.x;
		if (min == null || max == null) return [];
		return list
			.filter((marker) => marker.t >= min && marker.t <= max)
			.map((marker) => ({ marker, x: plot.valToPos(marker.t, 'x') }));
	}

	/** One hairline per marker across the plot, capped at the top, drawn over the series. */
	function drawMarkers(plot: uPlot, list: readonly ChartMarker[], ink: string) {
		const ratio = uPlot.pxRatio;
		const { top, height } = plot.bbox;
		const { ctx } = plot;
		ctx.save();
		ctx.strokeStyle = ink;
		ctx.fillStyle = ink;
		ctx.lineWidth = MARKER_LINE_WIDTH_PX * ratio;
		for (const { marker } of visibleMarkers(plot, list)) {
			// Whole device pixels plus half the width keep a 1 px line sharp.
			const x = Math.round(plot.valToPos(marker.t, 'x', true)) + ctx.lineWidth / 2;
			ctx.beginPath();
			ctx.moveTo(x, top);
			ctx.lineTo(x, top + height);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(x, top, MARKER_CAP_RADIUS_PX * ratio, 0, 2 * Math.PI);
			ctx.fill();
		}
		ctx.restore();
	}

	/** The marker nearest the cursor, within reach, placed for the tooltip. */
	function hoverMarker(plot: uPlot, list: readonly ChartMarker[], host: HTMLElement) {
		const left = plot.cursor.left;
		if (left == null || left < 0) return null;
		const nearest = visibleMarkers(plot, list).reduce<{ marker: ChartMarker; x: number } | null>(
			(best, item) =>
				Math.abs(item.x - left) <= MARKER_HIT_PX &&
				(best === null || Math.abs(item.x - left) < Math.abs(best.x - left))
					? item
					: best,
			null
		);
		if (!nearest) return null;
		const over = plot.over.getBoundingClientRect();
		const origin = host.getBoundingClientRect();
		const x = over.left - origin.left + nearest.x;
		return {
			marker: nearest.marker,
			x,
			top: over.top - origin.top,
			alignRight: x > origin.width / 2
		};
	}

	function options(
		width: number,
		colours: ReturnType<typeof readPalette>,
		currentMarkers: readonly ChartMarker[],
		host: HTMLElement
	): uPlot.Options {
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
				// A key set to `undefined` replaces uPlot's default rather than falling back to it, and
				// without `space` or `incrs` uPlot computes no ticks: no labels, no grid. Only set them
				// when there is a value.
				{
					...axis,
					...(compact && { space: COMPACT_TICK_SPACE.x }),
					values: (_plot, splits) => splits.map((seconds) => formatAxisTime(seconds))
				},
				{
					...axis,
					...(compact && { space: COMPACT_TICK_SPACE.y }),
					...(increments && { incrs: [...increments] }),
					size: axisSize,
					values: (_plot, splits) => splits.map((value) => formatValue(value))
				}
			],
			series: [
				{
					label: MONITORING_COPY.series.time,
					value: (plot, seconds, _series, index) => {
						if (index != null) return seconds == null ? NO_VALUE : formatPointTime(seconds);
						const newest = newestTime(plot);
						return newest == null ? NO_VALUE : MONITORING_COPY.newestPoint(formatPointTime(newest));
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
			bands: band ? [{ series: [band[0] + 1, band[1] + 1], fill: colours.band }] : undefined,
			hooks:
				currentMarkers.length > 0
					? {
							draw: [(plot) => drawMarkers(plot, currentMarkers, colours.marker)],
							setCursor: [
								(plot) => {
									hovered = compact ? null : hoverMarker(plot, currentMarkers, host);
								}
							]
						}
					: {}
		};
	}

	$effect(() => {
		if (!container || !palette) return;
		const target = container;
		const host = target.parentElement ?? target;
		const plot = new uPlot(
			options(target.clientWidth, readPalette(palette), markers, host),
			columns as uPlot.AlignedData,
			target
		);
		const observer = new ResizeObserver(() => plot.setSize({ width: target.clientWidth, height }));
		observer.observe(target);
		return () => {
			observer.disconnect();
			plot.destroy();
			hovered = null;
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
		<!-- An event, not data: the ink of secondary text, apart from the teal series and the pale grid. -->
		<span data-tone="marker" class="text-muted"></span>
		<span data-tone="axis" class="text-muted"></span>
		<span data-tone="grid" class="text-border"></span>
	</div>
	<div class="relative">
		<div bind:this={container} class="w-full"></div>
		{#if hovered}
			<div
				class="pointer-events-none absolute z-10 flex max-w-56 flex-col gap-0.5 rounded-overlay border border-border bg-surface px-3 py-2 text-xs shadow-overlay"
				style:top="{hovered.top}px"
				style:left={hovered.alignRight ? undefined : `${hovered.x + TOOLTIP_OFFSET_PX}px`}
				style:right={hovered.alignRight
					? `calc(100% - ${hovered.x - TOOLTIP_OFFSET_PX}px)`
					: undefined}
				data-testid="chart-marker-tooltip"
			>
				<span class="font-semibold text-foreground">{hovered.marker.title}</span>
				<span class="line-clamp-2 wrap-anywhere text-foreground">{hovered.marker.detail}</span>
				<span class="text-muted">{hovered.marker.time}</span>
			</div>
		{/if}
	</div>
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
