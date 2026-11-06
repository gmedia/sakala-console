<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		label: string;
		value: string;
		href?: string | null;
		mono?: boolean;
		testId?: string;
	};

	let { label, value, href = null, mono = false, testId }: Props = $props();

	const valueClass = $derived(
		cn('min-w-0 wrap-anywhere text-foreground', mono && 'font-mono text-xs leading-5 tabular-nums')
	);
</script>

<dt class="text-muted">{label}</dt>
<dd class={valueClass} data-testid={testId}>
	{#if href}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a commit on GitHub -->
		<a
			{href}
			target="_blank"
			rel="external noopener noreferrer"
			class="inline-flex min-h-6 items-center text-primary-dark underline underline-offset-2"
			>{value}</a
		>
	{:else}
		{value}
	{/if}
</dd>
