<script lang="ts">
	import { CheckIcon, XIcon, ArrowsClockwiseIcon } from 'phosphor-svelte';
	type Status = 'pending' | 'running' | 'success' | 'failed';
	type Size = 'sm' | 'md' | 'lg';

	type Props = {
		status: Status;
		size?: Size;
		label?: string;
		showLabel?: boolean;
	};

	let { status, size = 'md', label, showLabel = true }: Props = $props();

	const dotSizeMap: Record<Size, string> = {
		sm: 'size-5',
		md: 'size-6',
		lg: 'size-7'
	};

	const iconSizePxMap: Record<Size, number> = {
		sm: 11,
		md: 13,
		lg: 15
	};

	const colorMap: Record<Status, string> = {
		pending: 'bg-muted ring-1 ring-inset ring-muted/50',
		running: 'bg-primary text-white',
		success: 'bg-success-dark text-white',
		failed: 'bg-error text-white'
	};

	const defaultLabelMap: Record<Status, string> = {
		pending: 'Menunggu',
		running: 'Berjalan',
		success: 'Berhasil',
		failed: 'Gagal'
	};

	let dotSize = $derived(dotSizeMap[size]);
	let iconSizePx = $derived(iconSizePxMap[size]);
	let dotColor = $derived(colorMap[status]);
	let displayLabel = $derived(label ?? defaultLabelMap[status]);
</script>

<span class="inline-flex items-center gap-2.5">
	<span class="inline-flex shrink-0 items-center justify-center rounded-full {dotSize} {dotColor}">
		{#if status === 'running'}
			<ArrowsClockwiseIcon size={iconSizePx} class="animate-spin" />
		{:else if status === 'success'}
			<CheckIcon size={iconSizePx} weight="bold" class="w-4 h-4" />
		{:else if status === 'failed'}
			<XIcon size={iconSizePx} weight="bold" class="w-4 h-4" />
		{/if}
	</span>

	{#if showLabel && displayLabel}
		<span class="text-sm">
			{displayLabel}
		</span>
	{/if}
</span>
