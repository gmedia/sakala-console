<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatDuration, formatRelativeTime } from '$lib/utils/date';
	import type { Deployment } from '../../type';
	import { getDeploymentBadge, getDeploymentCardNote } from '../../presentation';

	let { deployment }: { deployment: Deployment } = $props();

	const badge = $derived(getDeploymentBadge(deployment.status));

	function getDurationText(startStr: string | null, finishStr: string | null) {
		if (!startStr || !finishStr) return 'Durasi tidak diketahui';
		const diffMs = new Date(finishStr).getTime() - new Date(startStr).getTime();
		if (diffMs < 0) return 'Durasi tidak diketahui';
		return `Durasi ${formatDuration(Math.floor(diffMs / 1000))}`;
	}
</script>

<div class="surface-card flex w-full min-w-0 min-h-67.25 flex-col p-5">
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div class="flex min-w-0 flex-col gap-1">
			<h3 class="text-base font-semibold text-foreground">
				Deployment #{deployment.sequence || 0}
			</h3>
			<div class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
				<span class="min-w-0 wrap-anywhere">{deployment.branch || 'main'}</span>
				<span aria-hidden="true">&bull;</span>
				<span>{deployment.created_at ? formatRelativeTime(deployment.created_at) : '-'}</span>
			</div>
		</div>
		<Badge tone={badge.variant}>{badge.label}</Badge>
	</div>

	<div
		class="bg-muted/10 rounded-card px-4 flex flex-col items-center justify-center text-center gap-2 mt-4 w-full h-30 shrink-0"
	>
		<p
			class="w-full text-sm font-medium text-foreground line-clamp-2 wrap-anywhere"
			title={deployment.commit_message ?? undefined}
		>
			{deployment.commit_message || 'Deployment manual'}
		</p>
		{#if deployment.commit_sha}
			<span class="text-xs text-muted font-mono">
				{deployment.commit_sha.substring(0, 7)}
			</span>
		{/if}
	</div>

	<div class="flex flex-wrap items-center justify-between gap-2 mt-auto pt-5">
		<span class="text-xs font-semibold text-muted">
			{getDeploymentCardNote(deployment) ??
				getDurationText(deployment.started_at, deployment.finished_at)}
		</span>
		<Button
			variant="secondary"
			size="sm"
			class="shrink-0"
			href={resolve(`/projects/${deployment.project_id}/deployments/${deployment.id}`)}
		>
			Lihat detail
		</Button>
	</div>
</div>
