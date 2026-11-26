<script lang="ts">
	// Steps link to anchors on the page (`#domain`) or to resolved routes, which the rule cannot tell.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { tick } from 'svelte';
	import X from 'phosphor-svelte/lib/X';
	import { SuggestionIcon } from '$lib/components/icons';
	import Button from '$lib/components/ui/Button.svelte';
	import PanelCard from './PanelCard.svelte';
	import PanelRestoreLink from './PanelRestoreLink.svelte';
	import { MAX_PANEL_STEPS, PANEL_COPY, PANEL_IDS, type PanelStep } from './panel';

	type Props = {
		/** Only steps that apply now and are not hidden; the card is absent without any. */
		steps: readonly PanelStep[];
		testid?: string;
		/** Hides one step for good; without it the steps cannot be hidden. */
		onDismiss?: (id: string) => void;
		/** Steps that would apply but were hidden; with `onRestore`, offers them back. */
		hiddenCount?: number;
		onRestore?: () => void;
	};

	let {
		steps,
		testid = 'panel-next-steps',
		onDismiss,
		hiddenCount = 0,
		onRestore
	}: Props = $props();

	const shown = $derived(steps.slice(0, MAX_PANEL_STEPS));
	let list: HTMLUListElement | null = $state(null);

	/**
	 * The button under the pointer is gone after a dismiss, so focus moves to the step that took its
	 * place, or the one before it, then the restore link, then the page's content.
	 */
	async function dismiss(index: number, id: string) {
		onDismiss?.(id);
		await tick();
		const buttons = [...(list?.querySelectorAll<HTMLElement>('[data-dismiss-step]') ?? [])];
		const next =
			buttons[index] ??
			buttons[index - 1] ??
			document.getElementById(PANEL_IDS.restore) ??
			document.getElementById('main-content');
		next?.focus();
	}
</script>

{#if shown.length > 0}
	<PanelCard
		title={PANEL_COPY.next}
		icon={SuggestionIcon}
		{testid}
		headingId={PANEL_IDS.nextHeading}
	>
		<ul class="flex flex-col" bind:this={list}>
			{#each shown as step, index (step.id)}
				<li class="flex items-center justify-between gap-2" data-testid="{testid}-{step.id}">
					<a
						href={step.href}
						class="inline-flex min-h-8 min-w-0 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
					>
						{step.label}
					</a>
					{#if onDismiss}
						<Button
							variant="ghost"
							size="icon-sm"
							class="text-muted hover:text-foreground"
							aria-label={PANEL_COPY.dismissStep(step.label)}
							title={PANEL_COPY.dismissStep(step.label)}
							data-dismiss-step
							onclick={() => dismiss(index, step.id)}
						>
							<X size={14} aria-hidden="true" />
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
		{#if onRestore && hiddenCount > 0}
			<PanelRestoreLink {onRestore} />
		{/if}
	</PanelCard>
{/if}
