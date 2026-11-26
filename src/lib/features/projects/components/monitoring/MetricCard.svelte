<script lang="ts">
	import type { Snippet } from 'svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { MONITORING_COPY } from '../../monitoring/format';

	type Props = {
		/** Ties the heading and summary to the card, unique on the page. */
		id: string;
		title: string;
		/** The newest value and the highest in the range, in words. Read instead of the canvas. */
		summary: string;
		/** A fact the chart draws, such as the limit behind its dashed line. */
		note?: string | null;
		/** How the chart counts, folded behind "Pelajari" under the summary. */
		learnMore?: string | null;
		hasData: boolean;
		chart: Snippet;
	};

	let { id, title, summary, note = null, learnMore = null, hasData, chart }: Props = $props();
</script>

<figure
	class="surface-card m-0 flex min-w-0 flex-col gap-3 p-4"
	aria-labelledby={`${id}-title`}
	aria-describedby={`${id}-summary`}
	data-testid={`metric-${id}`}
>
	<figcaption class="flex flex-col gap-1">
		<h2 id={`${id}-title`} class="font-sans text-base font-semibold text-foreground">{title}</h2>
		<p id={`${id}-summary`} class="text-sm text-foreground">{summary}</p>
		{#if note}
			<p class="text-xs text-muted">{note}</p>
		{/if}
		{#if learnMore}
			<LearnMore topic={MONITORING_COPY.learnTopic(title)}>
				<p>{learnMore}</p>
			</LearnMore>
		{/if}
	</figcaption>
	{#if hasData}
		{@render chart()}
	{:else if summary !== MONITORING_COPY.noPointsInRange}
		<p class="text-sm text-muted">{MONITORING_COPY.noPointsInRange}</p>
	{/if}
</figure>
