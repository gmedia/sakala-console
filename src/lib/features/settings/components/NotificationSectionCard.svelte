<script lang="ts">
	import type { Component, Snippet } from 'svelte';

	type Props = {
		title: string;
		icon?: Component<{ size?: number; class?: string }>;
		iconText?: string;
		children: Snippet;
	};

	let { title, icon: Icon, iconText, children }: Props = $props();
</script>

<div class="surface-card overflow-hidden">
	<div
		class="flex items-center gap-2 border-b border-border bg-surface-tint px-6 py-3 text-sm font-semibold text-primary-dark"
	>
		{#if Icon}
			<Icon size={18} />
		{:else if iconText}
			<span>{iconText}</span>
		{/if}
		<span>{title}</span>
	</div>

	<div class="divide-y divide-border p-6 space-y-2">
		{@render children()}
	</div>
</div>
