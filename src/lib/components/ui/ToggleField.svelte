<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		title: string;
		description: string;
		checked: boolean;
		disabled?: boolean;
		onToggle: () => void;
	};

	let { title, description, checked, disabled = false, onToggle }: Props = $props();

	const descriptionId = $derived(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-description`);
</script>

<div class="flex items-center justify-between gap-4 py-3">
	<div class="min-w-0">
		<p class="text-sm font-semibold text-foreground">{title}</p>
		<p id={descriptionId} class="mt-0.5 text-xs text-muted">{description}</p>
	</div>
	<button
		type="button"
		role="switch"
		aria-label={title}
		aria-checked={checked}
		aria-describedby={descriptionId}
		{disabled}
		onclick={onToggle}
		class={cn(
			'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
			checked ? 'bg-primary-dark' : 'bg-muted'
		)}
	>
		<span
			class={cn(
				'pointer-events-none inline-block size-5 transform rounded-full bg-surface ring-0 transition duration-200 ease-in-out',
				checked ? 'translate-x-5' : 'translate-x-0'
			)}
		></span>
	</button>
</div>
