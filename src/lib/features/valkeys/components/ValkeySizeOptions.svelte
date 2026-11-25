<script lang="ts">
	import type { SizeOption } from '../presentation';

	type Props = {
		value: number;
		options: SizeOption[];
		legend?: string;
		/** What the size means and how much is left, read with the group. */
		hint: string;
		error?: string | null;
		disabled?: boolean;
	};

	let {
		value = $bindable(),
		options,
		legend = 'Ukuran',
		hint,
		error = null,
		disabled = false
	}: Props = $props();

	const uid = $props.id();
	const reasons = $derived(
		[...new Set(options.filter((option) => option.reason).map((option) => option.reason))].join(' ')
	);
</script>

<fieldset
	class="flex min-w-0 flex-col gap-2"
	aria-describedby="{uid}-hint"
	{disabled}
	data-testid="valkey-size-options"
>
	<legend class="mb-1 text-sm font-medium text-foreground">{legend}</legend>
	<div class="flex flex-wrap gap-2">
		{#each options as option (option.mb)}
			<label
				class="inline-flex min-h-control-sm items-center gap-2 rounded-full border px-4 text-sm tabular-nums has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2 max-lg:min-h-control-lg {option.disabled ||
				disabled
					? 'cursor-not-allowed border-border bg-background-soft text-muted'
					: value === option.mb
						? 'cursor-pointer border-primary bg-primary-50 font-medium text-primary-dark'
						: 'cursor-pointer border-border-strong bg-surface text-foreground hover:border-primary'}"
			>
				<input
					type="radio"
					name="{uid}-size"
					value={option.mb}
					bind:group={value}
					disabled={option.disabled}
					class="sr-only"
				/>
				{option.label}
			</label>
		{/each}
	</div>
	<p id="{uid}-hint" class="text-xs text-foreground/70">
		{hint}
		{#if reasons}
			{reasons}
		{/if}
	</p>
	{#if error}
		<p class="text-xs text-error-dark" role="alert">{error}</p>
	{/if}
</fieldset>
