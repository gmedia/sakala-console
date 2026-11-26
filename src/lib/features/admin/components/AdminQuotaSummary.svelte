<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import type { WorkspaceQuota } from '$lib/api/resources/admin/accounts';
	import { idleSleepLine, replicasLine } from '$lib/features/workspaces/limits';
	import AdminEditButton from './AdminEditButton.svelte';
	import { formatNumber } from '../format';

	type Props = {
		quota: WorkspaceQuota;
		/** The profile's name when none is set: "Default pribadi" or "Default tim". */
		defaultLabel: string;
		/** Opens the profile dialog; absent, the profile cannot be changed from here. */
		onEditProfile?: () => void;
	};

	let { quota, defaultLabel, onEditProfile }: Props = $props();

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

	const perProject = $derived(
		[
			`Per proyek: memori ${formatNumber(quota.limits.max_memory_mb)} MB, CPU ${formatNumber(quota.limits.max_cpu_millis)} millicore, ${formatNumber(quota.limits.max_active_deployments_per_project)} deployment berjalan.`,
			quota.limits.idle_sleep_minutes !== undefined
				? idleSleepLine(quota.limits.idle_sleep_minutes)
				: null,
			quota.limits.max_replicas !== undefined ? replicasLine(quota.limits.max_replicas) : null
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<!-- Limits as badges under the name (docs/UI_GUIDELINES.md): the profile, then use against each
     limit as "Proyek 1/3" (denser than the members' "1 dari 3 proyek"); a full one says so in
     words and colour. -->
<div class="flex flex-col gap-1" data-testid="admin-quota">
	<div class="flex flex-wrap items-center gap-2">
		<Badge tone="neutral">Profil: {quota.limit_profile?.name ?? defaultLabel}</Badge>
		{#if onEditProfile}
			<AdminEditButton subject="profil batas" onclick={onEditProfile} />
		{/if}
		{#each rows as row (row.label)}
			{@const full = row.used >= row.max}
			<Badge tone={full ? 'error' : 'muted'}
				>{row.label} {formatNumber(row.used)}/{formatNumber(row.max)}{full ? ' (penuh)' : ''}</Badge
			>
		{/each}
	</div>
	<p class="text-xs text-muted">{perProject}</p>
</div>
