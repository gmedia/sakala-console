<script lang="ts">
	import type { WorkspaceQuota } from '$lib/api/resources/admin/accounts';
	import { formatNumber } from '../format';
	import { idleSleepLine } from '$lib/features/workspaces/limits';

	let { quota, defaultLabel }: { quota: WorkspaceQuota; defaultLabel: string } = $props();

	const rows = $derived([
		{ label: 'Proyek', used: quota.usage.projects, max: quota.limits.max_projects },
		{
			label: 'Container berjalan',
			used: quota.usage.active_containers,
			max: quota.limits.max_active_containers
		},
		{
			label: 'Deployment berjalan',
			used: quota.usage.active_deployments,
			max: quota.limits.max_active_deployments
		}
	]);
</script>

<div class="surface-card flex flex-col gap-4 p-5">
	<p class="text-sm">
		Profil: <strong>{quota.limit_profile?.name ?? defaultLabel}</strong>
	</p>
	<ul class="flex flex-col gap-3">
		{#each rows as row (row.label)}
			{@const full = row.used >= row.max}
			<li>
				<div class="flex justify-between gap-3 text-sm">
					<span>{row.label}</span>
					<span class="tabular-nums {full ? 'font-semibold text-error' : ''}">
						{formatNumber(row.used)} / {formatNumber(row.max)}{full ? ' (penuh)' : ''}
					</span>
				</div>
				<div class="mt-1.5 h-2 rounded-full bg-background-soft" aria-hidden="true">
					<div
						class="h-2 rounded-full {full ? 'bg-error' : 'bg-primary'}"
						style:width={`${Math.min((row.used / Math.max(row.max, 1)) * 100, 100)}%`}
					></div>
				</div>
			</li>
		{/each}
	</ul>
	<p class="text-xs text-muted">
		Per proyek: memori {formatNumber(quota.limits.max_memory_mb)} MB, CPU {formatNumber(
			quota.limits.max_cpu_millis
		)} millicore,
		{formatNumber(quota.limits.max_active_deployments_per_project)} deployment berjalan.
	</p>
	{#if quota.limits.idle_sleep_minutes !== undefined}
		<p class="text-xs text-muted">{idleSleepLine(quota.limits.idle_sleep_minutes)}</p>
	{/if}
</div>
