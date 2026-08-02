<script lang="ts">
	type step = {
		number: number;
		title: string;
	};

	type Props = {
		currentStep: number;
		steps?: step[];
		allowClickUpComing?: boolean;
		onStepClick?: (step: number) => void;
	};

	let {
		currentStep,
		steps = [
			{ number: 1, title: 'Repository' },
			{ number: 2, title: 'Auto Detect' },
			{ number: 3, title: 'Deploy' }
		],
		allowClickUpComing = false,
		onStepClick
	}: Props = $props();

	function getStatus(stepNumber: number): 'completed' | 'active' | 'upcoming' {
		if (stepNumber < currentStep) {
			return 'completed';
		} else if (stepNumber === currentStep) {
			return 'active';
		} else {
			return 'upcoming';
		}
	}

	function isClickable(stepNumber: number, status: ReturnType<typeof getStatus>) {
		if (status === 'completed') return true;
		if (status === 'active') return false;
		return allowClickUpComing;
	}

	function handleClick(stepNumber: number, status: ReturnType<typeof getStatus>) {
		if (!isClickable(stepNumber, status)) return;
		onStepClick?.(stepNumber);
	}
</script>

<div class="flex items-center w-full mt-2">
	{#each steps as step, i (step.number)}
		{@const status = getStatus(step.number)}
		{@const clickable = isClickable(step.number, status)}

		<div class="flex items-center justify-center {i === steps.length - 1 ? '' : 'flex-1'}">
			<button
				type="button"
				disabled={!clickable}
				onclick={() => handleClick(step.number, status)}
				class={[
					'flex justify-center items-center gap-2 bg-transparent border-0 p-0 appearance-none',
					clickable ? 'cursor-pointer' : 'cursor-default'
				]}
			>
				<div
					class={[
						'flex items-center justify-center w-10 h-10 rounded-full text-md font-medium transition-colors',
						status === 'completed' && 'bg-primary border-primary text-white',
						status === 'active' && 'border-primary text-white font-montserrat-semibold bg-primary',
						status === 'upcoming' && ' text-muted bg-muted/20',
						clickable && 'group-hover:opacity-80'
					]}
				>
					{step.number}
				</div>
				<span
					class={[
						'text-md font-montserrat-semibold whitespace-nowrap',
						status === 'active' && 'text-foreground',
						status === 'completed' && 'text-foreground',
						status === 'upcoming' && 'text-muted',
						clickable && 'group-hover:underline'
					]}
				>
					{step.title}
				</span>
			</button>

			{#if i !== steps.length - 1}
				<div
					class={[
						'flex-1 h-0.5 mx-10 rounded-full transition-colors',
						status === 'completed' ? 'bg-primary' : 'bg-muted'
					]}
				></div>
			{/if}
		</div>
	{/each}
</div>
