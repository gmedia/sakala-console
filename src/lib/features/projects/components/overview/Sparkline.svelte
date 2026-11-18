<script lang="ts">
	import type { AlignedColumns } from '../../monitoring/chart-data';

	type Props = {
		/** `[times, values]`; a `null` value breaks the line, like a gap on the Metrik tab. */
		columns: AlignedColumns;
		/** The window in Unix seconds, so a quiet stretch at either end shows as empty space. */
		xRange: [number, number];
	};

	let { columns, xRange }: Props = $props();

	const WIDTH = 100;
	const HEIGHT = 32;
	/** Room for the 2 px stroke at the top and bottom edges. */
	const INSET = 2;

	/** One path, with a move wherever a gap starts. The axis starts at zero, so the shape is honest. */
	const path = $derived.by(() => {
		const [times, values = []] = columns;
		const [start, end] = xRange;
		const span = Math.max(1, end - start);
		const peak = Math.max(0, ...values.filter((value): value is number => value !== null));
		if (peak === 0 && values.every((value) => value === null)) return '';
		const x = (time: number) => ((time - start) / span) * WIDTH;
		const y = (value: number) =>
			HEIGHT - INSET - (peak === 0 ? 0 : (value / peak) * (HEIGHT - 2 * INSET));

		let drawing = false;
		return times
			.map((time, index) => {
				const value = values[index];
				if (value === null || value === undefined) {
					drawing = false;
					return '';
				}
				const command = drawing ? 'L' : 'M';
				drawing = true;
				return `${command}${x(time).toFixed(2)} ${y(value).toFixed(2)}`;
			})
			.join(' ')
			.trim();
	});
</script>

<!-- Decorative: the numbers beside it say the same in text, and the Metrik tab has the detail. -->
<svg
	viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
	preserveAspectRatio="none"
	class="h-8 w-full overflow-visible"
	aria-hidden="true"
	focusable="false"
>
	<line
		x1="0"
		x2={WIDTH}
		y1={HEIGHT - INSET}
		y2={HEIGHT - INSET}
		class="stroke-border"
		stroke-width="1"
		vector-effect="non-scaling-stroke"
	/>
	{#if path}
		<path
			d={path}
			fill="none"
			class="stroke-primary"
			stroke-width="2"
			stroke-linejoin="round"
			stroke-linecap="round"
			vector-effect="non-scaling-stroke"
		/>
	{/if}
</svg>
