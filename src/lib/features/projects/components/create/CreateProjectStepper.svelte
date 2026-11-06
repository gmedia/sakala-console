<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';

	type Step = {
		number: number;
		title: string;
	};

	type Props = {
		currentStep: number;
		steps?: Step[];
	};

	let {
		currentStep,
		steps = [
			{ number: 1, title: 'Repository' },
			{ number: 2, title: 'Konfigurasi' },
			{ number: 3, title: 'Deteksi otomatis' }
		]
	}: Props = $props();

	function getStatus(stepNumber: number): 'completed' | 'active' | 'upcoming' {
		if (stepNumber < currentStep) return 'completed';
		return stepNumber === currentStep ? 'active' : 'upcoming';
	}
</script>

<div class="mt-2 sm:hidden" data-testid="stepper-compact">
	<p class="text-sm font-medium text-foreground" aria-current="step">
		Langkah {currentStep} dari {steps.length}, {steps[currentStep - 1]?.title}
	</p>
	<div class="mt-2 flex gap-1" aria-hidden="true">
		{#each steps as step (step.number)}
			<span
				class={[
					'h-1 flex-1 rounded-full',
					step.number <= currentStep ? 'bg-primary' : 'bg-muted/30'
				]}
			></span>
		{/each}
	</div>
</div>

<ol
	class="mt-2 hidden w-full items-start sm:flex lg:items-center"
	aria-label="Langkah pembuatan proyek"
>
	{#each steps as step, i (step.number)}
		{@const status = getStatus(step.number)}

		<li
			class="flex items-center justify-center {i === steps.length - 1 ? '' : 'flex-1'}"
			aria-current={status === 'active' ? 'step' : undefined}
		>
			<div class="flex flex-col items-center gap-2 lg:flex-row">
				<div
					class={[
						'flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors lg:h-10 lg:w-10 lg:text-base',
						status === 'completed' && 'bg-primary text-white',
						status === 'active' && 'bg-primary font-semibold text-white',
						status === 'upcoming' && 'bg-muted/20 text-foreground/70'
					]}
				>
					{#if status === 'completed'}
						<Check size={16} weight="bold" aria-hidden="true" />
						<span class="sr-only">Selesai: langkah {step.number}</span>
					{:else}
						{step.number}
					{/if}
				</div>
				<span
					class={[
						'max-w-20 text-center text-xs font-semibold lg:max-w-none lg:text-left lg:text-base',
						status === 'upcoming' ? 'text-foreground/70' : 'text-foreground'
					]}
				>
					{step.title}
				</span>
			</div>

			{#if i !== steps.length - 1}
				<div
					aria-hidden="true"
					class={[
						'mx-2 h-0.5 flex-1 rounded-full transition-colors lg:mx-6',
						status === 'completed' ? 'bg-primary' : 'bg-muted'
					]}
				></div>
			{/if}
		</li>
	{/each}
</ol>
