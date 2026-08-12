<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import OnboardingStep1 from '$lib/features/onboarding/components/OnboardingStep1.svelte';
	import OnboardingStep2 from '$lib/features/onboarding/components/OnboardingStep2.svelte';
	import OnboardingStep3 from '$lib/features/onboarding/components/OnboardingStep3.svelte';
	import type {
		DeveloperRole,
		OnboardingData,
		OnboardingSource
	} from '$lib/features/onboarding/types';

	let currentStep = $state(1);
	let data = $state<OnboardingData>({ role: 'developer' });

	function handleSourceSelect(source: OnboardingSource) {
		data.source = source;
	}

	function handleProfileUpdate(update: { displayName?: string; role?: DeveloperRole }) {
		if (update.displayName !== undefined) data.displayName = update.displayName;
		if (update.role !== undefined) data.role = update.role;
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

<div class="flex min-h-screen w-full items-center justify-center bg-background text-black">
	{#if currentStep === 1}
		<OnboardingStep1
			selectedSource={data.source}
			onSelect={handleSourceSelect}
			onNext={nextStep}
			onSkip={nextStep}
		/>
	{:else if currentStep === 2}
		<OnboardingStep2
			displayName={data.displayName}
			selectedRole={data.role}
			onUpdate={handleProfileUpdate}
			onNext={nextStep}
			onSkip={nextStep}
			onBack={prevStep}
		/>
	{:else if currentStep === 3}
		<OnboardingStep3 onFinish={finishOnboarding} onBack={prevStep} />
	{/if}
</div>
