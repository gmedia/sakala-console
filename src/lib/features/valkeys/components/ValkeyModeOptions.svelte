<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { VALKEY_MODES, type ValkeyMode } from '$lib/api/resources/valkeys';
	import {
		MODE_FIXED_NOTE,
		MODE_RECOMMENDED_LABEL,
		MODE_VIEWS,
		RECOMMENDED_VALKEY_MODE
	} from '../presentation';

	type Props = {
		value: ValkeyMode;
		/** Shown under the legend, for example a refused `mode`. */
		error?: string | null;
	};

	let { value = $bindable(), error = null }: Props = $props();

	const uid = $props.id();
</script>

<fieldset
	class="flex min-w-0 flex-col gap-2"
	aria-describedby="{uid}-note"
	data-testid="valkey-mode-options"
>
	<legend class="mb-1 text-sm font-medium text-foreground">Mode</legend>
	<div class="grid gap-3 sm:grid-cols-2">
		{#each VALKEY_MODES as mode (mode)}
			{@const view = MODE_VIEWS[mode]}
			<label
				class="flex min-w-0 cursor-pointer flex-col gap-2 rounded-control border p-4 text-sm transition-colors has-checked:border-primary has-checked:bg-primary-50 has-focus-visible:ring-2 has-focus-visible:ring-primary has-focus-visible:ring-offset-2 {value ===
				mode
					? 'border-primary'
					: 'border-border-strong hover:border-primary'}"
				data-testid="valkey-mode-{mode}"
			>
				<span class="flex flex-wrap items-center gap-2">
					<input
						type="radio"
						name="{uid}-mode"
						value={mode}
						bind:group={value}
						class="size-4 shrink-0"
						aria-describedby="{uid}-{mode}-summary"
					/>
					<span class="font-semibold text-foreground">{view.label}</span>
					{#if mode === RECOMMENDED_VALKEY_MODE}
						<Badge tone="neutral">{MODE_RECOMMENDED_LABEL}</Badge>
					{/if}
				</span>
				<span id="{uid}-{mode}-summary" class="flex flex-col gap-1">
					<span class="text-foreground">{view.useFor}</span>
					<span class="text-muted">{view.summary} {view.whenFull}</span>
				</span>
			</label>
		{/each}
	</div>
	<p id="{uid}-note" class="text-xs text-foreground/70">{MODE_FIXED_NOTE}</p>
	{#if error}
		<p class="text-xs text-error-dark" role="alert">{error}</p>
	{/if}
</fieldset>
