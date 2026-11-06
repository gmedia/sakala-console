<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import { tick } from 'svelte';
	import OnboardingProfileStep from '$lib/features/onboarding/components/OnboardingProfileStep.svelte';
	import OnboardingSourceStep from '$lib/features/onboarding/components/OnboardingSourceStep.svelte';
	import OnboardingReadyStep from '$lib/features/onboarding/components/OnboardingReadyStep.svelte';
	import { useOnboardingFlow } from '$lib/features/onboarding/use-onboarding-flow.svelte';

	const flow = useOnboardingFlow();

	// The button that was pressed is gone with its step, so focus moves to the new heading.
	let previousStep = flow.step;
	$effect(() => {
		if (flow.step === previousStep) return;
		previousStep = flow.step;
		void tick().then(() => document.getElementById('onboarding-heading')?.focus());
	});
</script>

<svelte:head>
	<title>{pageTitle('Mulai')}</title>
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="flex min-h-screen w-full items-start justify-center bg-background text-foreground outline-none sm:items-center"
>
	{#if flow.step === 1}
		<OnboardingProfileStep
			displayName={flow.profileName}
			selectedRole={flow.profileRole}
			isSubmitPending={flow.isSubmittingProfile}
			isSkipPending={flow.isSkippingProfile}
			errorMessage={flow.profileErrorMessage}
			onUpdate={flow.updateProfile}
			onNext={flow.submitProfile}
			onSkip={flow.skipProfile}
		/>
	{:else if flow.step === 2}
		<OnboardingSourceStep
			isSubmitPending={flow.isSubmittingSource}
			isSkipPending={flow.isSkippingSource}
			errorMessage={flow.sourceErrorMessage}
			selectedSource={flow.selectedSource}
			onSelect={flow.selectSource}
			onNext={flow.submitSource}
			onSkip={flow.skipSource}
			onBack={flow.back}
		/>
	{:else if flow.step === 3}
		<OnboardingReadyStep
			onFinish={flow.finish}
			errorMessage={flow.completeErrorMessage}
			onBack={flow.back}
			isPending={flow.completeMutation.isPending}
		/>
	{/if}
</main>
