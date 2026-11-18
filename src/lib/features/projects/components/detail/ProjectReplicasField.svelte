<script lang="ts">
	import { MIN_REPLICAS, REPLICAS_COPY, replicasAvailable, replicasHint } from '../../replicas';

	type Props = {
		/** The draft as text, so an emptied field stays empty until it is checked. */
		value: string;
		maxReplicas: number;
		error?: string;
		onValueChange: (value: string) => void;
	};

	let { value, maxReplicas, error, onValueChange }: Props = $props();

	const id = 'replicas';
	const available = $derived(replicasAvailable(maxReplicas));
	const describedBy = $derived(error ? `${id}-error` : `${id}-hint`);
</script>

<div class="space-y-1.5">
	<label for={id} class="block text-sm font-medium text-foreground">{REPLICAS_COPY.label}</label>
	<!-- A number input binds a number, or null when emptied, so it goes back to text here. -->
	<input
		{id}
		type="number"
		inputmode="numeric"
		min={MIN_REPLICAS}
		max={maxReplicas}
		step="1"
		disabled={!available}
		bind:value={() => value, (next: number | string | null) => onValueChange(String(next ?? ''))}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		class="control-input max-w-32 tabular-nums"
	/>
	{#if error}
		<p id={`${id}-error`} class="text-xs text-error-base">{error}</p>
	{:else}
		<p id={`${id}-hint`} class="text-xs text-foreground/70">{replicasHint(maxReplicas)}</p>
	{/if}
</div>
