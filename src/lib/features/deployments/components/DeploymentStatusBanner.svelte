<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import { getStatusDisplay, type BannerStatus } from '../status-config';
	import { cn } from '$lib/utils/cn';

	type Props = {
		status: BannerStatus;
		currentStepLabel?: string;
		durationLabel?: string;
		failedStepLabel?: string;
	};

	let { status, currentStepLabel, durationLabel, failedStepLabel }: Props = $props();

	let display = $derived(
		getStatusDisplay({ status, currentStepLabel, durationLabel, failedStepLabel })
	);

	let descColorClass = $derived(
		cn(
			'text-muted',
			status === 'running' && 'text-warning-dark',
			status === 'failed' && 'text-error',
			status === 'success' && 'text-success'
		)
	);
</script>

<div class="rounded-lg p-4 mt-2 flex items-center gap-3 font-montserrat {display.bannerBgClass}">
	<StatusIndicator
		{status}
		size="lg"
		showLabel={false}
		colorClassOverride={display.iconColorClass}
		animateIcon={false}
	/>
	<div>
		<h2 class="font-semibold">{display.title}</h2>
		<p class="text-sm font-normal {descColorClass}">{display.desc}</p>
	</div>
</div>
