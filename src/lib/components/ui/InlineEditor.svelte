<script lang="ts">
	import type { Snippet } from 'svelte';
	import { focusEditorField } from './inline-edit.svelte';
	import Button from './Button.svelte';

	type Props = {
		/** Named by the trigger's `aria-controls`. */
		id: string;
		/** The form's name for a screen reader: "Ubah nama database". */
		label: string;
		/** The field or fields, with their own labels, hints, and errors. */
		children: Snippet;
		onsubmit: (event: SubmitEvent) => void;
		/** Batal and Escape; the owner closes the editor and sends focus back to its trigger. */
		onCancel: () => void;
		pending?: boolean;
		submitDisabled?: boolean;
		submitLabel?: string;
		testid?: string;
		submitTestid?: string;
	};

	let {
		id,
		label,
		children,
		onsubmit,
		onCancel,
		pending = false,
		submitDisabled = false,
		submitLabel = 'Simpan',
		testid,
		submitTestid
	}: Props = $props();

	/**
	 * Opened on purpose, so the field takes focus: the checked option of a group, or the first field.
	 * Escape cancels from any field, as in a dialog.
	 */
	function behave(form: HTMLFormElement) {
		focusEditorField(form);

		const onkeydown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || pending) return;
			event.preventDefault();
			onCancel();
		};
		form.addEventListener('keydown', onkeydown);
		return () => form.removeEventListener('keydown', onkeydown);
	}
</script>

<form
	{@attach behave}
	{id}
	aria-label={label}
	class="flex min-w-0 flex-col gap-3 rounded-control border border-border bg-background-soft p-3"
	novalidate
	{onsubmit}
	data-testid={testid}
>
	{@render children()}
	<div class="flex flex-wrap gap-2">
		<Button
			type="submit"
			variant="secondary"
			size="sm"
			disabled={pending || submitDisabled}
			data-testid={submitTestid}
		>
			{pending ? 'Menyimpan...' : submitLabel}
		</Button>
		<Button type="button" variant="ghost" size="sm" disabled={pending} onclick={onCancel}>
			Batal
		</Button>
	</div>
</form>
