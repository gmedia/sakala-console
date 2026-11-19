<script lang="ts">
	import { cn } from '$lib/utils/cn';

	type Props = {
		checked: boolean;
		/** The accessible name; a switch has no visible text of its own. */
		label: string;
		describedBy?: string;
		disabled?: boolean;
		busy?: boolean;
		onToggle: () => void;
	};

	let { checked, label, describedBy, disabled = false, busy = false, onToggle }: Props = $props();
</script>

<button
	type="button"
	role="switch"
	aria-label={label}
	aria-checked={checked}
	aria-describedby={describedBy}
	aria-busy={busy || undefined}
	{disabled}
	onclick={onToggle}
	class={cn(
		'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:ring-2 focus-visible:ring-primary-dark focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
		checked ? 'bg-primary-dark' : 'bg-muted'
	)}
>
	<span
		class={cn(
			'pointer-events-none inline-block size-5 transform rounded-full bg-surface ring-0 transition duration-200 ease-in-out motion-reduce:transition-none',
			checked ? 'translate-x-5' : 'translate-x-0'
		)}
	></span>
</button>
