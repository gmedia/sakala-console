<script lang="ts">
	import OnboardingStep1 from '$lib/features/onboarding/components/OnboardingStep1.svelte';
	import OnboardingStep2 from '$lib/features/onboarding/components/OnboardingStep2.svelte';
	import OnboardingStep3 from '$lib/features/onboarding/components/OnboardingStep3.svelte';
	import { useOnboardingFlow } from '$lib/features/onboarding/use-onboarding-flow.svelte';

	const flow = useOnboardingFlow();
</script>

<svelte:head>
	<title>Onboarding | Sakala Console</title>
</svelte:head>

<div class="flex min-h-screen w-full items-center justify-center bg-background text-black">
	{#if flow.step === 1}
		<OnboardingStep1
			isPending={flow.sourceMutation.isPending}
			selectedSource={flow.selectedSource}
			onSelect={flow.selectSource}
			onNext={flow.submitSource}
			onSkip={flow.skipSource}
		/>
	{:else if flow.step === 2}
		<OnboardingStep2
			displayName={flow.profileName}
			selectedRole={flow.profileRole}
			isPending={flow.profileMutation.isPending}
			onUpdate={flow.updateProfile}
			onNext={flow.submitProfile}
			onSkip={flow.skipProfile}
			onBack={flow.back}
		/>
	{:else if flow.step === 3}
		<OnboardingStep3
			onFinish={flow.finish}
			onBack={flow.back}
			isPending={flow.completeMutation.isPending}
		/>
	{/if}
</div>
