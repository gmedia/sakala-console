<script lang="ts">
	import Switch from './Switch.svelte';

	type Props = {
		title: string;
		description: string;
		checked: boolean;
		disabled?: boolean;
		onToggle: () => void;
	};

	let { title, description, checked, disabled = false, onToggle }: Props = $props();

	const uid = $props.id();
	const descriptionId = `${uid}-description`;
</script>

<div class="flex items-center justify-between gap-4 py-3">
	<div class="min-w-0">
		<p class="text-sm font-semibold text-foreground">{title}</p>
		<p id={descriptionId} class="mt-0.5 text-xs text-muted">{description}</p>
	</div>
	<Switch label={title} {checked} {disabled} describedBy={descriptionId} {onToggle} />
</div>
