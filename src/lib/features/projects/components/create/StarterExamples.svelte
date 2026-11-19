<script lang="ts">
	import ArrowRightIcon from 'phosphor-svelte/lib/ArrowRightIcon';
	import CircleNotchIcon from 'phosphor-svelte/lib/CircleNotchIcon';
	import { STARTER_EXAMPLES, type StarterExample } from '$lib/config/starter-examples';

	type Props = {
		/** The example being checked with the API, while its button shows progress. */
		pendingId?: string | null;
		disabled?: boolean;
		error?: string | null;
		onPick: (example: StarterExample) => void;
	};

	let { pendingId = null, disabled = false, error = null, onPick }: Props = $props();
</script>

<!-- `contoh` is the anchor the welcome screen links to. -->
<section
	id="contoh"
	aria-labelledby="starter-examples-title"
	class="flex scroll-mt-4 flex-col gap-2"
>
	<div>
		<h3 id="starter-examples-title" class="font-sans text-sm font-semibold text-foreground">
			Belum punya repo? Coba dengan contoh
		</h3>
		<p class="text-sm text-foreground/70">
			Aplikasi kecil dari tim Sakala. Konfigurasinya langsung terisi.
		</p>
	</div>
	<ul class="grid gap-2 sm:grid-cols-3">
		{#each STARTER_EXAMPLES as example (example.id)}
			<li class="min-w-0">
				<button
					type="button"
					class="flex h-full min-h-control-lg w-full cursor-pointer items-start justify-between gap-2 rounded-control border border-border bg-surface p-3 text-left hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-60"
					disabled={disabled || pendingId !== null}
					aria-busy={pendingId === example.id}
					onclick={() => onPick(example)}
				>
					<span class="min-w-0">
						<span class="block text-sm font-semibold text-foreground">{example.label}</span>
						<span class="block text-xs text-foreground/70">{example.description}</span>
					</span>
					{#if pendingId === example.id}
						<CircleNotchIcon
							class="mt-0.5 size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
							aria-hidden="true"
						/>
					{:else}
						<ArrowRightIcon class="mt-0.5 size-4 shrink-0 text-primary-dark" aria-hidden="true" />
					{/if}
				</button>
			</li>
		{/each}
	</ul>
	{#if error}
		<p class="text-sm text-error-dark" role="alert">{error}</p>
	{/if}
</section>
