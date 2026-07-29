<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import OnboardingStep1 from '$lib/features/onboarding/components/OnboardingStep1.svelte';
	import OnboardingStep2 from '$lib/features/onboarding/components/OnboardingStep2.svelte';
	import OnboardingStep3 from '$lib/features/onboarding/components/OnboardingStep3.svelte';
	import type { OnboardingData, OnboardingSource } from '$lib/features/onboarding/types';

	let currentStep = $state(1);
	let data = $state<OnboardingData>({});

	function handleSourceSelect(source: OnboardingSource) {
		data.source = source;
	}

	function nextStep() {
		if (currentStep < 3) {
			currentStep += 1;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep -= 1;
		}
	}

	function finishOnboarding() {
		goto(resolve('/projects'));
	}
</script>

<svelte:head>
	<title>Onboarding | Sakala Console</title>
</svelte:head>

<div class="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
	{#if currentStep === 1}
		<OnboardingStep1
			selectedSource={data.source}
			onSelect={handleSourceSelect}
			onNext={nextStep}
			onBack={prevStep}
		/>
	{:else if currentStep === 2}
		<OnboardingStep2 onNext={nextStep} onBack={prevStep} />
	{:else if currentStep === 3}
		<OnboardingStep3 onFinish={finishOnboarding} onBack={prevStep} />
	{/if}
</div>
