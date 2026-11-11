<script lang="ts">
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import Check from 'phosphor-svelte/lib/Check';
	import X from 'phosphor-svelte/lib/X';
	import { cn } from '$lib/utils/cn';

	type Status = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
	type Size = 'sm' | 'md' | 'lg' | 'xl';

	type Props = {
		status: Status;
		size?: Size;
		label?: string;
		showLabel?: boolean;
		colorClassOverride?: string;
		animateIcon?: boolean;
		showIcon?: boolean;
	};

	let {
		status,
		size = 'md',
		label,
		showLabel = true,
		colorClassOverride,
		animateIcon = true,
		showIcon = true
	}: Props = $props();

	const dotSizeMap: Record<Size, string> = {
		sm: 'size-5',
		md: 'size-6',
		lg: 'size-7',
		xl: 'size-12'
	};

	const iconSizePxMap: Record<Size, number> = {
		sm: 11,
		md: 13,
		lg: 15,
		xl: 20
	};

	// Not started yet is the quietest thing on the page. The ring is drawn by the track below.
	const colorMap: Record<Status, string> = {
		pending: 'border-2 border-border-strong bg-surface',
		running: 'bg-primary text-white',
		success: 'bg-success-dark text-white',
		failed: 'bg-error text-white',
		cancelled: 'bg-muted text-white'
	};

	const defaultLabelMap: Record<Status, string> = {
		pending: 'Menunggu',
		running: 'Berjalan',
		success: 'Berhasil',
		failed: 'Gagal',
		cancelled: 'Dibatalkan'
	};

	let dotSize = $derived(dotSizeMap[size]);
	let iconSizePx = $derived(iconSizePxMap[size]);
	let dotColor = $derived(colorClassOverride ?? colorMap[status]);
	let displayLabel = $derived(label ?? defaultLabelMap[status]);
</script>

<span class="inline-flex items-center gap-2.5">
	<span
		class={cn('inline-flex shrink-0 items-center justify-center rounded-full', dotSize, dotColor)}
		aria-hidden="true"
	>
		{#if status === 'running' && showIcon}
			<ArrowsClockwise
				size={iconSizePx}
				weight="bold"
				class={animateIcon ? 'animate-spin motion-reduce:animate-none' : ''}
			/>
		{:else if status === 'success'}
			<Check size={iconSizePx} weight="bold" />
		{:else if status === 'failed' || status === 'cancelled'}
			<X size={iconSizePx} weight="bold" />
		{/if}
	</span>

	{#if displayLabel}
		<span class={showLabel ? 'text-sm' : 'sr-only'}>
			{displayLabel}
		</span>
	{/if}
</span>
