<script lang="ts">
	type Props = {
		compact?: boolean;
		class?: string;
	};

	let { compact = false, class: className = '' }: Props = $props();
</script>

<a href="https://sakala.dev" class={`inline-flex items-center ${className}`} aria-label="Sakala">
	{#if compact}
		<img src="/favicon.svg" alt="" width="40" height="40" class="size-9 object-contain" />
		<span class="ml-2 text-xl font-semibold tracking-[-0.03em]">Sakala</span>
	{:else}
		<img src="/logo.svg" alt="Sakala" width="218" height="54" class="h-12 w-auto max-w-full" />
	{/if}
</a>
