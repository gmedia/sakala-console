<script lang="ts">
	import type { Snippet } from 'svelte';
	import CaretDownIcon from 'phosphor-svelte/lib/CaretDownIcon';

	/**
	 * A collapsed group of suggestions: its name, how many, and which keys, so the user can tell
	 * what is inside without opening it (Miller's Law). The disclosure pattern is the one the
	 * wizard's "Pengaturan lanjutan" already uses.
	 */
	type Props = {
		title: string;
		count: number;
		keys: readonly string[];
		description: string;
		headingLevel?: 3 | 4;
		children: Snippet;
	};

	let { title, count, keys, description, headingLevel = 4, children }: Props = $props();

	/** Names shown under a closed group; the rest are counted. */
	const PREVIEW_KEYS = 4;

	const id = $props.id();
	let open = $state(false);
	const preview = $derived(
		keys.length > PREVIEW_KEYS
			? `${keys.slice(0, PREVIEW_KEYS).join(', ')}, dan ${keys.length - PREVIEW_KEYS} lainnya`
			: keys.join(', ')
	);
</script>

<section class="flex flex-col border-t border-border pt-2" aria-labelledby="{id}-button">
	<svelte:element this={`h${headingLevel}`} class="font-sans text-sm font-semibold">
		<button
			type="button"
			id="{id}-button"
			class="flex min-h-control-lg w-full cursor-pointer items-center justify-between gap-2 rounded-control text-left text-sm font-semibold text-foreground lg:min-h-control-md"
			aria-expanded={open}
			aria-controls="{id}-panel"
			onclick={() => (open = !open)}
		>
			<span>{title} ({count})</span>
			<CaretDownIcon
				class={open ? 'size-4 shrink-0 rotate-180' : 'size-4 shrink-0'}
				aria-hidden="true"
			/>
		</button>
	</svelte:element>
	{#if !open}
		<p class="font-mono text-xs wrap-anywhere text-foreground/70">{preview}</p>
	{/if}
	<div id="{id}-panel" class="flex-col gap-2 pt-1 {open ? 'flex' : 'hidden'}">
		<p class="text-xs text-foreground/70">{description}</p>
		{@render children()}
	</div>
</section>
