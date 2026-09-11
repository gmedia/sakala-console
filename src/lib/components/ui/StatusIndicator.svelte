<script lang="ts">
	import { Check, X, RefreshCw } from '@lucide/svelte';
	type Status = 'pending' | 'running' | 'success' | 'failed';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		status: Status;
		size?: Size;
		label?: string;
		showLabel?: boolean;
		colorClassOverride?: string;
		animateIcon?: boolean;
	};

	let {
		status,
		size = 'md',
		label,
		showLabel = true,
		colorClassOverride,
		animateIcon = true
	}: Props = $props();

	const dotSizeMap: Record<Size, string> = {
		sm: 'size-5',
		md: 'size-9',
		lg: 'size-14'
	};

	const iconSizePxMap: Record<Size, number> = {
		sm: 11,
		md: 13,
		lg: 18
	};

	const colorMap: Record<Status, string> = {
		pending: 'bg-muted ring-1 ring-inset ring-muted/50',
		running: 'bg-muted text-white',
		success: 'bg-success-dark text-white',
		failed: 'bg-error-dark text-white'
	};

	const defaultLabelMap: Record<Status, string> = {
		pending: 'Menunggu',
		running: 'Berjalan',
		success: 'Berhasil',
		failed: 'Gagal'
	};

	let dotSize = $derived(dotSizeMap[size]);
	let iconSizePx = $derived(iconSizePxMap[size]);
	let dotColor = $derived(colorClassOverride ?? colorMap[status]);
	let displayLabel = $derived(label ?? defaultLabelMap[status]);
</script>

<span class="inline-flex items-center gap-2.5">
	<span
		class="inline-flex shrink-0 items-center justify-center rounded-full {dotSize} {dotColor}"
		aria-hidden="true"
	>
		{#if status === 'running'}
			<RefreshCw size={iconSizePx} strokeWidth={2.5} class={animateIcon ? 'animate-spin' : ''} />
		{:else if status === 'success'}
			<Check size={iconSizePx} strokeWidth={3} />
		{:else if status === 'failed'}
			<X size={iconSizePx} strokeWidth={3} />
		{/if}
	</span>

	{#if displayLabel}
		<span class={showLabel ? 'text-sm' : 'sr-only'}>
			{displayLabel}
		</span>
	{/if}
</span>
