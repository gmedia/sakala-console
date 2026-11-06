<script lang="ts">
	import { ACTIVE_DEPLOYMENT_STATUSES, type Deployment, type DeploymentStatus } from '../../type';
	import { formatDate, formatDuration } from '$lib/utils/date';
	import { getDeploymentCardNote, getDeploymentCardStatusLabel } from '../../presentation';

	let { deployment }: { deployment: Deployment } = $props();

	function isActive(status: string): boolean {
		return ACTIVE_DEPLOYMENT_STATUSES.includes(status as DeploymentStatus);
	}

	function getBadgeStyle(status: string) {
		if (status === 'succeeded' || status === 'success') return 'bg-success/10 text-success';
		if (status === 'failed') return 'bg-error/10 text-error';
		if (status === 'cancelled') return 'bg-muted/20 text-foreground/70';
		if (isActive(status)) return 'bg-warning/10 text-warning';
		return 'bg-muted/20 text-foreground/70';
	}

	function getDotStyle(status: string) {
		if (status === 'succeeded' || status === 'success') return 'bg-success';
		if (status === 'failed') return 'bg-error';
		if (isActive(status)) return 'bg-warning';
		return 'bg-muted';
	}

	function formatRelativeTime(dateString: string) {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'Baru saja';
		if (diffMins < 60) return `${diffMins} menit lalu`;
		if (diffHours < 24) return `${diffHours} jam lalu`;
		if (diffDays < 2) return 'Kemarin';
		if (diffDays < 30) return `${diffDays} hari lalu`;
		return formatDate(dateString);
	}

	function getDurationText(startStr: string | null, finishStr: string | null) {
		if (!startStr || !finishStr) return 'Durasi tidak diketahui';
		const diffMs = new Date(finishStr).getTime() - new Date(startStr).getTime();
		if (diffMs < 0) return 'Durasi tidak diketahui';
		return `Durasi ${formatDuration(Math.floor(diffMs / 1000))}`;
	}
</script>

<div class="bg-surface rounded-xl p-5 flex flex-col w-full min-w-0 min-h-67.25">
	<div class="flex items-start justify-between gap-2">
		<div class="flex min-w-0 flex-col gap-1">
			<h3 class="font-montserrat-semibold text-foreground text-base">
				Deployment #{deployment.sequence || 0}
			</h3>
			<div class="flex flex-wrap items-center gap-x-1.5 text-xs text-muted font-montserrat">
				<span class="min-w-0 wrap-anywhere">{deployment.branch || 'main'}</span>
				<span aria-hidden="true">&bull;</span>
				<span>{deployment.created_at ? formatRelativeTime(deployment.created_at) : '-'}</span>
			</div>
		</div>
		<div
			class="flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold {getBadgeStyle(
				deployment.status
			)}"
		>
			<span class="size-1.5 rounded-full {getDotStyle(deployment.status)}"></span>
			{getDeploymentCardStatusLabel(deployment.status)}
		</div>
	</div>

	<div
		class="bg-muted/10 rounded-xl px-4 flex flex-col items-center justify-center text-center gap-2 mt-4 w-full h-30 shrink-0"
	>
		<p
			class="w-full text-sm font-montserrat-medium text-foreground line-clamp-2 leading-relaxed wrap-anywhere"
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
		<span class="text-xs font-montserrat-semibold text-muted">
			{getDeploymentCardNote(deployment) ??
				getDurationText(deployment.started_at, deployment.finished_at)}
		</span>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href={`/projects/${deployment.project_id}/deployments/${deployment.id}`}
			class="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-border-strong px-4 py-2 font-montserrat-semibold text-sm transition-colors hover:cursor-pointer hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
		>
			Lihat detail
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
</div>
