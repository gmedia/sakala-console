<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { cn } from '$lib/utils/cn';

	type Source = 'github' | 'git-url';
	let {
		value = $bindable()
	}: {
		value: Source;
	} = $props();

	const tabs: { value: Source; label: string }[] = [
		{ value: 'github', label: 'Dari GitHub' },
		{ value: 'git-url', label: 'Public Git URL' }
	];
</script>

<div class="grid w-full grid-cols-2 rounded-control bg-muted/10 p-2">
	{#each tabs as tab (tab.value)}
		<Button
			variant="ghost"
			aria-pressed={value === tab.value}
			class={cn(
				'w-full cursor-pointer rounded-control border-none py-3',
				value === tab.value
					? 'bg-surface text-foreground'
					: 'bg-transparent text-foreground/70 hover:bg-muted/10'
			)}
			onclick={() => (value = tab.value)}
		>
			{tab.label}
		</Button>
	{/each}
</div>
