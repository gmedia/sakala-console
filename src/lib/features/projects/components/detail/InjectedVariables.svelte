<script lang="ts">
	import type { Snippet } from 'svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import { VARIABLES_GUIDE_URL } from '$lib/config/project';
	import { INJECTED_VARIABLES_COPY as COPY } from '../../presentation';

	/**
	 * The variables Sakala fills in for an attached database, bucket, or Valkey store, under the
	 * project's own (docs/UI_GUIDELINES.md, text budget): the section's heading names the source once,
	 * each row shows the name and a hidden value like a secret, and only an override gets a badge.
	 */
	type Props = {
		rows: readonly { name: string; overridden: boolean }[];
		/** "database toko-db": read with each hidden value, so a screen reader hears where it is from. */
		source: string;
		/** Prefix of each row's test id: `database-variable-DATABASE_URL`. */
		testidPrefix: string;
		/** What else this source's "Pelajari" says, such as whether a change needs a build. */
		learnMore?: Snippet;
	};

	let { rows, source, testidPrefix, learnMore }: Props = $props();
</script>

<p class="text-sm text-muted">{COPY.intro}</p>

<ul
	class="@container flex w-full flex-col divide-y divide-border rounded-control border border-border bg-surface"
>
	{#each rows as row (row.name)}
		<li
			class="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 @2xl:grid-cols-[14.5rem_minmax(0,1fr)_auto] @2xl:px-6"
			data-testid={`${testidPrefix}-${row.name}`}
		>
			<span class="min-w-0 font-mono text-sm font-semibold wrap-anywhere text-foreground">
				{row.name}
			</span>
			<span
				class="col-span-2 row-start-2 min-w-0 text-sm @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1"
			>
				{#if row.overridden}
					<span class="text-foreground">{COPY.overriddenValue}</span>
				{:else}
					<span
						class="font-mono text-muted select-none"
						role="img"
						aria-label={COPY.hiddenValue(source)}>••••••••••••</span
					>
				{/if}
			</span>
			{#if row.overridden}
				<span class="col-start-2 row-start-1 @2xl:col-start-3">
					<Badge tone="warning">{COPY.overridden}</Badge>
				</span>
			{/if}
		</li>
	{/each}
</ul>

<LearnMore topic={COPY.learnTopic(source)}>
	<p>{COPY.learn}</p>
	{@render learnMore?.()}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the docs site -->
	<a
		href={VARIABLES_GUIDE_URL}
		target="_blank"
		rel="external noopener noreferrer"
		class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
	>
		{COPY.guide}<span class="sr-only">&nbsp;(tab baru)</span>
	</a>
</LearnMore>
