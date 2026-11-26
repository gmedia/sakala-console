<script lang="ts">
	import { EditIcon } from '$lib/components/icons';
	import Button from '$lib/components/ui/Button.svelte';

	/**
	 * "Ubah" beside the value it changes (docs/UI_GUIDELINES.md). Admin changes ask for a reason, so
	 * this opens the action's dialog instead of an inline editor.
	 */
	let { subject, onclick }: { subject: string; onclick: () => void } = $props();
</script>

<Button variant="ghost" size="sm" class="px-2" {onclick}>
	<EditIcon size={16} aria-hidden="true" />
	Ubah<span class="sr-only">&nbsp;{subject}</span>
</Button>
