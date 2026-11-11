<script lang="ts">
	import { formatNumber, formatShare } from '../format';

	type Segment = { key: string; label: string; value: number; color: string };

	type Props = { segments: Segment[]; centerValue: string; centerLabel: string; summary: string };

	let { segments, centerValue, centerLabel, summary }: Props = $props();

	const total = $derived(segments.reduce((sum, segment) => sum + segment.value, 0));
	const RADIUS = 42;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
	// A 2 px gap (in a 100-unit box) between fills keeps neighbours apart without colour.
	const GAP = 2;

	const arcs = $derived.by(() => {
		let offset = 0;
		const visible = segments.filter((segment) => segment.value > 0);
		return visible.map((segment) => {
			const length = (segment.value / Math.max(total, 1)) * CIRCUMFERENCE;
			const gap = visible.length > 1 ? Math.min(GAP, length / 2) : 0;
			const arc = {
				...segment,
				dash: `${Math.max(length - gap, 0)} ${CIRCUMFERENCE}`,
				offset: -offset
			};
			offset += length;
			return arc;
		});
	});
</script>

<div class="flex flex-col items-center gap-6 sm:flex-row">
	<div class="relative size-36 shrink-0">
		<svg viewBox="0 0 100 100" class="size-full -rotate-90" role="img" aria-label={summary}>
			<circle
				cx="50"
				cy="50"
				r={RADIUS}
				fill="none"
				stroke="var(--color-background-soft)"
				stroke-width="12"
			/>
			{#each arcs as arc (arc.key)}
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke={arc.color}
					stroke-width="12"
					stroke-dasharray={arc.dash}
					stroke-dashoffset={arc.offset}
				/>
			{/each}
		</svg>
		<div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
			<span class="font-display text-xl font-semibold text-foreground">{centerValue}</span>
			<span class="text-xs text-muted">{centerLabel}</span>
		</div>
	</div>
	<!-- The legend carries every number, so status never depends on telling the colours apart. -->
	<ul class="flex w-full flex-col gap-2 text-sm">
		{#each segments as segment (segment.key)}
			<li class="flex items-center justify-between gap-3">
				<span class="flex items-center gap-2">
					<span
						class="size-3 shrink-0 rounded-[3px]"
						style:background-color={segment.color}
						aria-hidden="true"
					></span>
					{segment.label}
				</span>
				<span class="text-foreground tabular-nums">
					<span class="font-semibold">{formatNumber(segment.value)}</span>
					<span class="text-muted">{formatShare(segment.value, total) ?? ''}</span>
				</span>
			</li>
		{/each}
	</ul>
</div>
