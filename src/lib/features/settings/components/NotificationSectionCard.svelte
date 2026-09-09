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

<div class="overflow-hidden rounded-2xl border border-border/70 bg-white shadow-xs">
	<div
		class="flex items-center gap-2 border-b border-border/60 bg-[#F1F7F4] px-6 py-3 font-sans text-sm font-semibold text-primary-dark"
	>
		{#if Icon}
			<Icon size={18} />
		{:else if iconText}
			<span>{iconText}</span>
		{/if}
		<span>{title}</span>
	</div>

	<div class="divide-y divide-border/60 p-6 space-y-2">
		{@render children()}
	</div>
</div>
