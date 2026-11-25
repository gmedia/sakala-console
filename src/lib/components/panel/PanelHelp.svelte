<script lang="ts">
	import type { Snippet } from 'svelte';
	import { GuideIcon } from '$lib/components/icons';
	import PanelCard from './PanelCard.svelte';
	import { PANEL_COPY, type PanelHelpLink } from './panel';

	type Props = {
		/** Guides with short names; each opens in a new tab. */
		links?: readonly PanelHelpLink[];
		/** Folded how-tos ("Pelajari") for a resource without a guide of its own yet. */
		children?: Snippet;
		testid?: string;
	};

	let { links = [], children, testid = 'panel-help' }: Props = $props();
</script>

<PanelCard title={PANEL_COPY.help} icon={GuideIcon} {testid}>
	{#if links.length > 0}
		<ul class="flex flex-col">
			{#each links as link (link.href)}
				<li>
					<a
						href={link.href}
						target="_blank"
						rel="external noopener noreferrer"
						class="inline-flex min-h-8 items-center text-sm text-foreground underline underline-offset-2 hover:text-primary-dark"
					>
						{link.label}<span class="sr-only">&nbsp;{PANEL_COPY.newTab}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
	{@render children?.()}
</PanelCard>
