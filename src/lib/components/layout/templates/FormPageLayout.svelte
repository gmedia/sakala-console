<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** The form or the resource's own cards, in the order they are worked through. */
		children: Snippet;
		/** Ringkasan, Berikutnya, and Bantuan cards (components/panel). */
		panel?: Snippet;
		/** The panel's landmark name, such as "Ringkasan proyek". */
		panelLabel?: string;
		/** What comes last on every screen, such as the danger zone: under the form when wide. */
		after?: Snippet;
	};

	let { children, panel, panelLabel = 'Ringkasan', after }: Props = $props();
</script>

<!--
	Form and settings template (docs/UI_GUIDELINES.md). Two columns only with the sidebar shown (lg)
	and a content area of 56rem: the sidebar takes about 360 px of the window, so the window alone
	cannot tell the room, and below 1024 px the drawer would otherwise bring a second column back on
	a tablet. Narrower, everything stacks in reading order: the form, the panel, then `after`, so a
	danger zone is never the next thing after the form on a phone.
-->
<div class="@container w-full" data-testid="form-page">
	<div class="grid items-start gap-4 lg:@4xl:grid-cols-[minmax(0,48rem)_18rem] lg:@4xl:gap-6">
		<div class="flex min-w-0 flex-col gap-4" data-testid="form-page-main">
			{@render children()}
		</div>
		{#if panel}
			<aside
				aria-label={panelLabel}
				class="flex min-w-0 flex-col gap-4 lg:@4xl:col-start-2 lg:@4xl:row-span-2 lg:@4xl:row-start-1"
				data-testid="form-page-panel"
			>
				{@render panel()}
			</aside>
		{/if}
		{#if after}
			<div class="flex min-w-0 flex-col gap-4 lg:@4xl:col-start-1" data-testid="form-page-after">
				{@render after()}
			</div>
		{/if}
	</div>
</div>
