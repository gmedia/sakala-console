<script lang="ts">
	import type { Snippet } from 'svelte';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import Question from 'phosphor-svelte/lib/Question';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import type { AuthStatusContent } from '../email-link-status';

	type Props = AuthStatusContent & {
		children: Snippet;
		/** For a screen that replaces what was just on screen, so a screen reader hears it. */
		focusHeading?: boolean;
	};

	let { tone, title, description, children, focusHeading = false }: Props = $props();

	const Icon = $derived(
		tone === 'success' ? CheckCircle : tone === 'error' ? WarningCircle : Question
	);
	const iconClass = $derived(
		tone === 'success' ? 'text-primary-600' : tone === 'error' ? 'text-error-base' : 'text-muted'
	);

	let heading = $state<HTMLHeadingElement>();

	$effect(() => {
		if (!focusHeading || !heading) return;
		const el = heading;
		const timer = setTimeout(() => el.focus(), 0);
		return () => clearTimeout(timer);
	});
</script>

<main
	id="main-content"
	tabindex="-1"
	class="flex min-h-screen flex-col items-center justify-center p-4 pb-24 outline-none sm:p-8"
>
	<SakalaLogo class="mb-10 h-10" />

	<Icon size={48} class={iconClass} aria-hidden="true" />

	<div class="mt-4 w-full max-w-reading text-center">
		<h1 bind:this={heading} tabindex="-1" class="text-2xl outline-none sm:text-3xl">{title}</h1>
		<p class="mx-auto mt-2 max-w-xl text-sm text-foreground sm:text-base">{description}</p>
	</div>

	<div class="mt-8 w-full max-w-sm space-y-4">
		{@render children()}
	</div>
</main>
