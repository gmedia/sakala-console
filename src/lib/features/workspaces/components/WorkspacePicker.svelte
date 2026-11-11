<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import type { Workspace } from '$lib/api/resources/workspaces';
	import PilotQuotaNotice from '$lib/features/projects/components/create/PilotQuotaNotice.svelte';
	import { ROLE_LABELS } from '../presentation';

	type Props = {
		/** Workspaces the user may create projects in. */
		workspaces: Workspace[];
		value: string | null;
		limits: PilotLimits | undefined;
		onChange: (workspaceId: string) => void;
	};

	let { workspaces, value, limits, onChange }: Props = $props();

	const selected = $derived(workspaces.find((workspace) => workspace.id === value) ?? null);
	const teamName = $derived(selected?.type === 'team' ? selected.name : undefined);
</script>

<!-- One workspace means no choice: someone working alone sees the quota line as before. -->
{#if workspaces.length > 1}
	<div class="flex flex-col gap-1" data-testid="workspace-picker">
		<label for="project-workspace" class="text-sm font-semibold">Workspace</label>
		<select
			id="project-workspace"
			value={value ?? ''}
			onchange={(event) => onChange(event.currentTarget.value)}
			class="control-input"
			aria-describedby="project-workspace-hint"
		>
			{#each workspaces as workspace (workspace.id)}
				<option value={workspace.id}>
					{workspace.type === 'personal'
						? 'Pribadi'
						: `${workspace.name} (${ROLE_LABELS[workspace.role].toLowerCase()})`}
				</option>
			{/each}
		</select>
		<p id="project-workspace-hint" class="text-xs text-muted">
			{teamName
				? 'Proyek dimiliki workspace tim, jadi pemilik dan anggotanya ikut mengelola.'
				: 'Proyek di workspace pribadi hanya bisa dibuka olehmu.'}
		</p>
	</div>
{/if}
<PilotQuotaNotice {limits} workspaceName={teamName} />
