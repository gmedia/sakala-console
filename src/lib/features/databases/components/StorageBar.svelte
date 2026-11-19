<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import type { StorageLevel, StorageMeter } from '../presentation';

	type Props = {
		meter: StorageMeter;
		/** Names the bar for a screen reader, for example the database or "Penyimpanan workspace". */
		label: string;
		class?: string;
	};

	let { meter, label, class: className }: Props = $props();

	const FILL: Record<StorageLevel, string> = {
		ok: 'bg-primary',
		warning: 'bg-warning',
		full: 'bg-error'
	};

	/** The level in words, so a full or nearly full quota never rests on colour. */
	const LEVEL_TEXT: Record<StorageLevel, string | null> = {
		ok: null,
		warning: 'hampir penuh',
		full: 'penuh'
	};

	const percent = $derived(Math.round(meter.ratio * 100));
</script>

<div class={cn('flex min-w-0 flex-col gap-1', className)}>
	<div
		class="h-2 w-full overflow-hidden rounded-full bg-background-soft ring-1 ring-border"
		role="meter"
		aria-label={label}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={percent}
		aria-valuetext={meter.accessibleLabel}
	>
		<div
			class={cn('h-full rounded-full', FILL[meter.level])}
			style:width={`${Math.max(percent, meter.ratio > 0 ? 2 : 0)}%`}
		></div>
	</div>
	<p class="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted tabular-nums">
		<span class="text-foreground">{meter.label}</span>
		{#if LEVEL_TEXT[meter.level]}
			<span
				class={meter.level === 'full'
					? 'font-medium text-error-dark'
					: 'font-medium text-warning-dark'}>{LEVEL_TEXT[meter.level]}</span
			>
		{/if}
	</p>
</div>
