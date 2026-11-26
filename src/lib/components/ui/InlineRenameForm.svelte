<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFieldError } from '$lib/api/errors';
	import FormField from './FormField.svelte';
	import InlineEditor from './InlineEditor.svelte';

	/**
	 * Renaming a managed resource (database, bucket, Valkey) in place: the same checks before
	 * sending, the API's own refusal on the field, and a toast once saved.
	 */
	type Props = {
		id: string;
		/** The field's label: "Nama database". */
		label: string;
		hint: string;
		/** The saved name. */
		value: string;
		maxLength: number;
		/** "database", "bucket", "Valkey": the word in the messages. */
		noun: string;
		save: (name: string) => Promise<unknown>;
		/** The resource's words for a refusal that is not about the field. */
		errorMessage: (error: unknown) => string;
		/** Closes the editor: after a save, Batal, or Escape. */
		onClose: () => void;
		testid?: string;
	};

	let { id, label, hint, value, maxLength, noun, save, errorMessage, onClose, testid }: Props =
		$props();

	// Starts from the saved name; the editor opens fresh each time.
	// svelte-ignore state_referenced_locally
	let name = $state(value);
	let nameError = $state<string | null>(null);
	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		nameError = null;
		if (!trimmed) {
			nameError = `Isi nama ${noun}.`;
			return;
		}
		if (trimmed.length > maxLength) {
			nameError = `Nama ${noun} paling panjang ${maxLength} karakter.`;
			return;
		}
		if (trimmed === value) {
			onClose();
			return;
		}
		saving = true;
		try {
			await save(trimmed);
			toast.success(`Nama ${noun} diganti menjadi ${trimmed}.`);
			onClose();
		} catch (error) {
			nameError = getFieldError(error, 'name') ?? errorMessage(error);
		} finally {
			saving = false;
		}
	}
</script>

<InlineEditor
	{id}
	label={`Ubah nama ${noun}`}
	onsubmit={submit}
	onCancel={onClose}
	pending={saving}
	submitDisabled={name.trim() === value}
	submitLabel="Simpan nama"
	{testid}
>
	<FormField
		id={`${id}-input`}
		{label}
		bind:value={name}
		{hint}
		error={nameError}
		autocomplete="off"
		spellcheck={false}
		oninput={() => (nameError = null)}
	/>
</InlineEditor>
