<script lang="ts">
	import ToggleField from '$lib/components/ui/ToggleField.svelte';

	type Props = {
		title: string;
		description: string;
		checked: boolean;
		onToggle: () => void;
	};

	let { title, description, checked, onToggle }: Props = $props();
</script>

<ToggleField {title} {description} {checked} {onToggle} />
