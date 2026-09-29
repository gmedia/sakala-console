<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		title: string;
		description: string;
		checked: boolean;
		onToggle: () => void;
	};

	let { title, description, checked, onToggle }: Props = $props();
</script>

<div class="flex items-center justify-between py-3">
	<div class="pr-4">
		<h4 class="font-sans text-sm font-semibold text-foreground">{title}</h4>
		<p class="mt-0.5 font-sans text-xs text-muted">{description}</p>
	</div>
	<button
		type="button"
		role="switch"
		aria-label={title}
		aria-checked={checked}
		onclick={onToggle}
		class={cn(
			'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2',
			checked ? 'bg-primary-dark' : 'bg-muted/30'
		)}
	>
		<span
			class={cn(
				'pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out',
				checked ? 'translate-x-5' : 'translate-x-0'
			)}
		></span>
	</button>
</div>
