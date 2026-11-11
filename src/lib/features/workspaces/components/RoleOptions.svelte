<script lang="ts">
	import type { WorkspaceRole } from '$lib/api/resources/workspaces';
	import { cn } from '$lib/utils/cn';
	import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_ORDER } from '../presentation';

	type Props = {
		name: string;
		legend: string;
		value: WorkspaceRole;
		/** Roles that cannot be chosen, each with the reason shown under it. */
		disabled?: Partial<Record<WorkspaceRole, string>>;
	};

	let { name, legend, value = $bindable(), disabled = {} }: Props = $props();
</script>

<fieldset class="flex flex-col gap-2">
	<legend class="mb-1 text-sm font-medium text-foreground">{legend}</legend>
	{#each ROLE_ORDER as role (role)}
		{@const reason = disabled[role]}
		<label
			class={cn(
				'flex gap-3 rounded-control border p-3 transition-colors',
				value === role ? 'border-primary bg-primary-50' : 'border-border',
				reason ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-background-soft'
			)}
		>
			<input
				type="radio"
				{name}
				value={role}
				bind:group={value}
				disabled={Boolean(reason)}
				class="mt-0.5 size-4 shrink-0 accent-primary"
			/>
			<span class="flex min-w-0 flex-col gap-0.5">
				<span class="text-sm font-medium text-foreground">{ROLE_LABELS[role]}</span>
				<span class="text-sm text-muted">{reason ?? ROLE_DESCRIPTIONS[role]}</span>
			</span>
		</label>
	{/each}
</fieldset>
