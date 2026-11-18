<script lang="ts">
	// Links here are resolveRoute() output from overview/links.ts, some with an anchor added, which
	// the rule cannot follow.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';
	import Button from '$lib/components/ui/Button.svelte';
	import { nextStepHref } from '../../overview/links';
	import type { NextStep } from '../../overview/next-steps';

	type Props = {
		projectId: string;
		steps: NextStep[];
		onDismiss: (id: string) => void;
	};

	let { projectId, steps, onDismiss }: Props = $props();

	let heading: HTMLHeadingElement | null = $state(null);
	/** After the last one is hidden the card stays for this visit, saying so, so focus has a home. */
	let dismissedHere = $state(false);

	/** Focus would fall to the page with the button gone, so it moves to the card's heading. */
	async function dismiss(step: NextStep) {
		onDismiss(step.id);
		dismissedHere = true;
		await tick();
		heading?.focus();
	}
</script>

{#if steps.length > 0 || dismissedHere}
	<section
		aria-labelledby="overview-next-title"
		class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-6"
		data-testid="overview-next-steps"
	>
		<h2
			id="overview-next-title"
			class="text-base text-foreground focus:outline-none"
			tabindex="-1"
			bind:this={heading}
		>
			Langkah berikutnya
		</h2>
		{#if steps.length === 0}
			<p class="text-sm text-muted" role="status">
				Saran disembunyikan. Tidak ada saran lain untuk proyek ini sekarang.
			</p>
		{:else}
			<ul class="flex flex-col divide-y divide-border">
				{#each steps as step (step.id)}
					<li
						class="flex items-start gap-2 py-3 first:pt-0 last:pb-0"
						data-testid={`next-step-${step.id}`}
					>
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<p class="text-sm font-medium text-foreground">{step.title}</p>
							<p class="text-sm text-muted">{step.body}</p>
							{#if step.command}
								<code
									class="self-start rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere text-foreground"
									>{step.command}</code
								>
							{/if}
							<div class="flex flex-wrap gap-x-4 gap-y-1">
								<a
									href={nextStepHref(step.action, projectId)}
									class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
								>
									{step.action.label}
								</a>
								{#if step.docs}
									<a
										href={step.docs.href}
										target="_blank"
										rel="external noopener noreferrer"
										class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
									>
										{step.docs.label}<span class="sr-only">(tab baru)</span>
									</a>
								{/if}
							</div>
						</div>
						<Button
							variant="ghost"
							size="icon-sm"
							class="-mt-1 -mr-1"
							aria-label={`Sembunyikan saran: ${step.title}`}
							title="Sembunyikan saran ini"
							onclick={() => dismiss(step)}
						>
							<X size={16} aria-hidden="true" />
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
