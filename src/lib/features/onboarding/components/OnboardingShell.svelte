<script lang="ts">
	import type { Snippet } from 'svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import { cn } from '$lib/utils/cn';

	type Props = {
		step: 1 | 2 | 3;
		title: string;
		description: string;
		children: Snippet;
		footer: Snippet;
	};

	let { step, title, description, children, footer }: Props = $props();
</script>

<!-- One container for all three steps, so going forward does not move anything sideways. -->
<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
	<SakalaLogo class="h-10 self-start" />

	<div class="space-y-3">
		<p class="text-sm font-medium text-muted">Langkah {step} dari 3</p>
		<div class="grid grid-cols-3 gap-2" aria-hidden="true">
			{#each [1, 2, 3] as segment (segment)}
				<span class={cn('h-1.5 rounded-full', segment <= step ? 'bg-primary' : 'bg-skeleton')}
				></span>
			{/each}
		</div>
	</div>

	<div class="space-y-2">
		<h1 id="onboarding-heading" tabindex="-1" class="text-2xl outline-none sm:text-3xl">{title}</h1>
		<p class="text-sm text-muted sm:text-base">{description}</p>
	</div>

	{@render children()}

	<div class="flex items-center justify-between gap-2">
		{@render footer()}
	</div>
</div>
