<script lang="ts">
	import { EditIcon } from '$lib/components/icons';
	import Button from './Button.svelte';

	type Props = {
		/** What it edits, read after "Ubah" by a screen reader: "nama database". */
		subject: string;
		/** Whether the editor it opens is showing. */
		expanded: boolean;
		/** The editor's id, named only while it is on the page. */
		controls: string;
		onclick: () => void;
		/** For sending focus back once the editor closes. */
		ref?: HTMLElement | null;
		testid?: string;
	};

	let { subject, expanded, controls, onclick, ref = $bindable(null), testid }: Props = $props();
</script>

<!-- A rarely used single-field edit sits next to its value (docs/UI_GUIDELINES.md). -->
<Button
	variant="ghost"
	size="sm"
	class="px-2"
	bind:ref
	aria-expanded={expanded}
	aria-controls={expanded ? controls : undefined}
	{onclick}
	data-testid={testid}
>
	<EditIcon size={16} aria-hidden="true" />
	Ubah<span class="sr-only">&nbsp;{subject}</span>
</Button>
