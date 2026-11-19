<script lang="ts">
	import { pageTitle } from '$lib/utils/page-title';
	import OnboardingWelcome from '$lib/features/onboarding/components/OnboardingWelcome.svelte';
	import { useOnboardingWelcome } from '$lib/features/onboarding/use-onboarding-welcome.svelte';

	const welcome = useOnboardingWelcome();
</script>

<svelte:head>
	<title>{pageTitle('Mulai')}</title>
</svelte:head>

<main
	id="main-content"
	tabindex="-1"
	class="flex min-h-screen w-full items-start justify-center bg-background text-foreground outline-none sm:items-center"
>
	<OnboardingWelcome
		pendingDestination={welcome.pendingDestination}
		errorMessage={welcome.errorMessage}
		onCreateProject={welcome.createProject}
		onOpenProjects={welcome.openProjects}
		onStartFromExample={welcome.startFromExample}
	/>
</main>
