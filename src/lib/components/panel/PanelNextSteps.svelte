<script lang="ts">
	// Steps link to anchors on the page (`#domain`) or to resolved routes, which the rule cannot tell.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { SuggestionIcon } from '$lib/components/icons';
	import PanelCard from './PanelCard.svelte';
	import { MAX_PANEL_STEPS, PANEL_COPY, type PanelStep } from './panel';

	type Props = {
		/** Only steps that apply now; the card is absent without any. */
		steps: readonly PanelStep[];
		testid?: string;
	};

	let { steps, testid = 'panel-next-steps' }: Props = $props();

	const shown = $derived(steps.slice(0, MAX_PANEL_STEPS));
</script>

{#if shown.length > 0}
	<PanelCard title={PANEL_COPY.next} icon={SuggestionIcon} {testid}>
		<ul class="flex flex-col">
			{#each shown as step (step.id)}
				<li data-testid="{testid}-{step.id}">
					<a
						href={step.href}
						class="inline-flex min-h-8 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					>
						{step.label}
					</a>
				</li>
			{/each}
		</ul>
	</PanelCard>
{/if}
