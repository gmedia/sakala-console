<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';

	export type DangerAction = {
		id: string;
		/** The button's words, the same as the confirm button of the dialog it opens. */
		label: string;
		onclick: () => void;
	};

	type Props = {
		/** One sentence: what these actions do. Each dialog says the rest and asks for a reason. */
		body: string;
		actions: DangerAction[];
		/** One sentence under it, for an action this resource cannot offer now and why. */
		note?: string | null;
	};

	let { body, actions, note = null }: Props = $props();
</script>

<!-- The page's danger zone (docs/UI_GUIDELINES.md): one row, the title and one sentence on the
     left, the buttons on the right, last on every screen. -->
{#if actions.length > 0 || note}
	<section
		class="flex min-w-0 flex-col gap-3 rounded-card border border-error/30 bg-surface p-4"
		aria-labelledby="admin-danger-title"
		data-testid="admin-danger-zone"
	>
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-3">
			<div class="flex min-w-0 flex-1 basis-56 flex-col gap-1">
				<h2 id="admin-danger-title" class="text-base text-error-dark">Zona berbahaya</h2>
				{#if actions.length > 0}
					<p class="text-sm text-foreground">{body}</p>
				{/if}
			</div>
			{#if actions.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each actions as action (action.id)}
						<Button variant="danger" size="sm" onclick={action.onclick}>{action.label}</Button>
					{/each}
				</div>
			{/if}
		</div>
		{#if note}
			<p class="text-sm text-foreground">{note}</p>
		{/if}
	</section>
{/if}
