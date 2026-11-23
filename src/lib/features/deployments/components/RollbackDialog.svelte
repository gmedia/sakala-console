<script lang="ts">
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { ROLLBACK_COPY, type RollbackPlan, type RollbackVersion } from '../rollback';

	type Props = {
		/** Open while set. */
		plan: RollbackPlan | null;
		isLoading?: boolean;
		error?: string;
		onConfirm: () => void;
		onClose: () => void;
	};

	let { plan, isLoading = false, error = '', onConfirm, onClose }: Props = $props();
</script>

{#snippet version(label: string, value: RollbackVersion | null, testId: string)}
	<div class="flex min-w-0 flex-col gap-0.5" data-testid={testId}>
		<dt class="text-xs text-muted">{label}</dt>
		<dd class="min-w-0">
			{#if value}
				<span class="flex flex-wrap gap-x-2 font-mono text-sm text-foreground tabular-nums">
					<span class="font-semibold">#{value.sequence}</span>
					<span>{value.shortSha ?? ROLLBACK_COPY.withoutCommit}</span>
				</span>
				<span class="block truncate text-sm text-foreground" title={value.message}
					>{value.message}</span
				>
			{:else}
				<span class="text-sm text-muted">{ROLLBACK_COPY.noneServing}</span>
			{/if}
		</dd>
	</div>
{/snippet}

<Dialog
	open={plan !== null}
	title={plan ? ROLLBACK_COPY.title(plan.target.sequence) : ''}
	confirmLabel={plan ? ROLLBACK_COPY.confirm(plan.target.sequence) : ''}
	cancelLabel={ROLLBACK_COPY.cancel}
	loading={isLoading}
	{onConfirm}
	onCancel={onClose}
	class="max-w-lg"
>
	{#if plan}
		<div class="flex flex-col gap-4" data-testid="rollback-dialog">
			<dl
				class="grid grid-cols-1 gap-3 rounded-control border border-border bg-background-soft p-3 sm:grid-cols-2"
			>
				{@render version(ROLLBACK_COPY.currentLabel, plan.current, 'rollback-current')}
				{@render version(ROLLBACK_COPY.targetLabel, plan.target, 'rollback-target')}
			</dl>
			<ul
				class="flex list-disc flex-col gap-1.5 pl-5 text-sm text-foreground"
				data-testid="rollback-notes"
			>
				{#each plan.notes as note (note)}
					<li>{note}</li>
				{/each}
			</ul>
			{#if error}
				<p role="alert" class="text-sm text-error-dark">{error}</p>
			{/if}
		</div>
	{/if}
</Dialog>
