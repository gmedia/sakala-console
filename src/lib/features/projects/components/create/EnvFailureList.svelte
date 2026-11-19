<script lang="ts">
	import type { EnvSaveFailure } from '../../create/createProjectState.svelte';
	import { normalizeEnvKey } from '../../validation/environmentVariable';

	/**
	 * Variables the API refused, each with its field to fix and the reason. The project exists, so
	 * only these are tried again. Shared by the wizard's save step and the first deploy.
	 */
	type Props = { failures: EnvSaveFailure[]; disabled?: boolean };

	let { failures, disabled = false }: Props = $props();
</script>

<ul class="flex flex-col gap-3">
	{#each failures as failure (failure.env.id)}
		<li class="flex flex-col gap-2 rounded-control border border-error/30 bg-surface p-3">
			<div class="grid gap-2 sm:grid-cols-2">
				<div class="min-w-0">
					<label for="retry-key-{failure.env.id}" class="text-sm font-medium">
						Nama variabel
					</label>
					<input
						id="retry-key-{failure.env.id}"
						value={failure.env.key}
						oninput={(event) => {
							failure.env.key = normalizeEnvKey(event.currentTarget.value);
							failure.keyError = undefined;
						}}
						{disabled}
						spellcheck="false"
						aria-invalid={failure.keyError ? 'true' : undefined}
						class="control-input font-mono"
					/>
					{#if failure.keyError}
						<p class="mt-1 text-xs text-error-dark">{failure.keyError}</p>
					{/if}
				</div>
				<div class="min-w-0">
					<label for="retry-value-{failure.env.id}" class="text-sm font-medium">
						Nilai variabel
					</label>
					<input
						id="retry-value-{failure.env.id}"
						type={failure.env.isSecret ? 'password' : 'text'}
						bind:value={failure.env.value}
						oninput={() => (failure.valueError = undefined)}
						{disabled}
						autocomplete="off"
						aria-invalid={failure.valueError ? 'true' : undefined}
						class="control-input"
					/>
					{#if failure.valueError}
						<p class="mt-1 text-xs text-error-dark">{failure.valueError}</p>
					{/if}
				</div>
			</div>
			{#if !failure.keyError && !failure.valueError}
				<p class="text-sm text-error-dark" role="alert">{failure.message}</p>
			{/if}
		</li>
	{/each}
</ul>
