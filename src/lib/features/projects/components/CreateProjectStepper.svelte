<script lang="ts">
	type step = {
		number: number;
		title: string;
	};

	type Props = {
		currentStep: number;
		steps?: step[];
	};

	let {
		currentStep,
		steps = [
			{ number: 1, title: 'Repository' },
			{ number: 2, title: 'Auto Detect' },
			{ number: 3, title: 'Deploy' }
		]
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
</script>

<div class="mt-2 flex w-full items-start md:items-center">
	{#each steps as step, i (step.number)}
		{@const status = getStatus(step.number)}

		<div class="flex items-center justify-center {i === steps.length - 1 ? '' : 'flex-1'}">
			<button type="button" class={['flex flex-col items-center gap-2 p-0 md:flex-row']}>
				<div
					class={[
						'flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors md:h-10 md:w-10 md:text-base',
						status === 'completed' && 'bg-primary border-primary text-white',
						status === 'active' && 'border-primary text-white font-montserrat-semibold bg-primary',
						status === 'upcoming' && ' text-muted bg-muted/20'
					]}
				>
					{step.number}
				</div>
				<span
					class={[
						'max-w-20 text-center text-xs font-montserrat-semibold md:max-w-none md:text-left md:text-base',
						status === 'active' && 'text-foreground',
						status === 'completed' && 'text-foreground',
						status === 'upcoming' && 'text-muted'
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
