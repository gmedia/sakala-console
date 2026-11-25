<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type Props = {
		title: string;
		/** At most one, from components/icons.ts. */
		icon?: Component<{ size?: number; class?: string; 'aria-hidden'?: boolean | 'true' }>;
		children: Snippet;
		testid?: string;
	};

	let { title, icon: Icon, children, testid }: Props = $props();

	const uid = $props.id();
</script>

<section
	aria-labelledby="{uid}-title"
	class="surface-card flex min-w-0 flex-col gap-2 p-4"
	data-testid={testid}
>
	<h2
		id="{uid}-title"
		class="flex items-center gap-2 font-sans text-base font-semibold text-foreground"
	>
		{#if Icon}
			<Icon size={18} class="shrink-0 text-muted" aria-hidden="true" />
		{/if}
		{title}
	</h2>
	{@render children()}
</section>
