<script lang="ts">
	type Option = { value: string; label: string };

	type Props = {
		id: string;
		label: string;
		value: string;
		options: readonly Option[];
		/** The label of the empty choice, which removes the filter. */
		allLabel?: string;
		onChange: (value: string) => void;
		class?: string;
	};

	let {
		id,
		label,
		value,
		options,
		allLabel = 'Semua',
		onChange,
		class: className = ''
	}: Props = $props();
</script>

<!-- A native select: keyboard, screen reader, and mobile pickers all work without help. -->
<div class={className}>
	<label for={id} class="mb-1 block text-xs font-medium text-muted">{label}</label>
	<select
		{id}
		class="control-input cursor-pointer pr-9"
		{value}
		onchange={(event) => onChange(event.currentTarget.value)}
	>
		<option value="">{allLabel}</option>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
</div>
