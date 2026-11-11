<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { RANGE_LABELS } from '../format';
	import { validateCustomRange, type RangeKey, type RangeState } from '../url-state';

	type Props = {
		id: string;
		value: RangeState;
		allowed: readonly RangeKey[];
		onChange: (next: RangeState) => void;
	};

	let { id, value, allowed, onChange }: Props = $props();

	// A custom range is a draft until applied, so half-typed dates never reach the API.
	let choice = $state<RangeKey>('30d');
	let from = $state('');
	let to = $state('');
	let error = $state<string | null>(null);

	$effect.pre(() => {
		choice = value.range;
		from = value.from;
		to = value.to;
		error = null;
	});

	function select(next: RangeKey) {
		choice = next;
		error = null;
		if (next !== 'custom') onChange({ range: next, from: '', to: '' });
	}

	function apply(event: SubmitEvent) {
		event.preventDefault();
		error = validateCustomRange(from, to);
		if (!error) onChange({ range: 'custom', from, to });
	}
</script>

<form class="flex flex-wrap items-end gap-2" onsubmit={apply}>
	<div>
		<label for={`${id}-range`} class="mb-1 block text-xs font-medium text-muted"
			>Rentang waktu</label
		>
		<select
			id={`${id}-range`}
			class="control-input w-auto cursor-pointer pr-9"
			value={choice}
			onchange={(event) => select(event.currentTarget.value as RangeKey)}
		>
			{#each allowed as key (key)}
				<option value={key}>{RANGE_LABELS[key]}</option>
			{/each}
		</select>
	</div>
	{#if choice === 'custom'}
		<div>
			<label for={`${id}-from`} class="mb-1 block text-xs font-medium text-muted">Dari</label>
			<input
				id={`${id}-from`}
				type="date"
				class="control-input w-auto"
				bind:value={from}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : undefined}
			/>
		</div>
		<div>
			<label for={`${id}-to`} class="mb-1 block text-xs font-medium text-muted">Sampai</label>
			<input
				id={`${id}-to`}
				type="date"
				class="control-input w-auto"
				bind:value={to}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? `${id}-error` : undefined}
			/>
		</div>
		<Button type="submit" variant="secondary" size="lg">Terapkan</Button>
		{#if error}
			<p id={`${id}-error`} class="w-full text-xs text-error-base" role="alert">{error}</p>
		{/if}
	{/if}
</form>
