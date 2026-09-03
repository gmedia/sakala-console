<script lang="ts">
	import type { Deployment } from '../../type';
	import { formatDate } from '$lib/utils/date';

	let { deployment }: { deployment: Deployment } = $props();

	function getBadgeStyle(status: string) {
		if (status === 'success') return 'bg-success/10 text-success';
		if (status === 'failed' || status === 'cancelled') return 'bg-error/10 text-error';
		if (status === 'running' || status === 'building' || status === 'queued')
			return 'bg-warning/10 text-warning';
		return 'bg-muted/20 text-muted';
	}

	function getDotStyle(status: string) {
		if (status === 'success') return 'bg-success';
		if (status === 'failed' || status === 'cancelled') return 'bg-error';
		if (status === 'running' || status === 'building' || status === 'queued') return 'bg-warning';
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

	function formatDuration(startStr: string | null, finishStr: string | null) {
		if (!startStr || !finishStr) return 'Durasi tidak diketahui';
		const start = new Date(startStr);
		const finish = new Date(finishStr);
		const diffMs = finish.getTime() - start.getTime();
		if (diffMs < 0) return 'Durasi tidak diketahui';

		const totalSeconds = Math.floor(diffMs / 1000);
		if (totalSeconds < 60) return `Durasi ${totalSeconds} detik`;

		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		return `Durasi ${mins}m ${secs}s`;
	}
</script>

<div class="bg-white rounded-xl p-5 flex flex-col w-full h-67.25">
	<div class="flex items-start justify-between">
		<div class="flex flex-col gap-1">
			<h3 class="font-montserrat-semibold text-foreground text-base">
				Deployment #{deployment.sequence || 0}
			</h3>
			<div class="flex items-center gap-1.5 text-xs text-muted font-montserrat">
				<span>{deployment.branch || 'main'}</span>
				<span>&bull;</span>
				<span>{deployment.created_at ? formatRelativeTime(deployment.created_at) : '-'}</span>
			</div>
		</div>
		<div
			class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize {getBadgeStyle(
				deployment.status
			)}"
		>
			<span class="size-1.5 rounded-full {getDotStyle(deployment.status)}"></span>
			{deployment.status === 'running' ||
			deployment.status === 'building' ||
			deployment.status === 'queued'
				? 'Deploying'
				: deployment.status.replace('_', ' ')}
		</div>
	</div>

	<div
		class="bg-muted/10 rounded-xl px-4 flex flex-col items-center justify-center text-center gap-2 mt-4 w-full h-30 shrink-0"
	>
		<p class="text-sm font-montserrat-medium text-foreground line-clamp-2 leading-relaxed">
			{deployment.commit_message || 'Manual Deployment'}
		</p>
		{#if deployment.commit_sha}
			<span class="text-xs text-muted font-mono">
				{deployment.commit_sha.substring(0, 7)}
			</span>
		{/if}
	</div>

	<div class="flex items-center justify-between mt-5">
		<span class="text-xs font-montserrat-semibold text-muted">
			{#if deployment.status === 'running' || deployment.status === 'building' || deployment.status === 'queued'}
				Tahap: {deployment.status}...
			{:else if deployment.status === 'failed' || deployment.status === 'cancelled'}
				Build error
			{:else}
				{formatDuration(deployment.started_at, deployment.finished_at)}
			{/if}
		</span>

		<button
			type="button"
			class="flex items-center justify-center w-21.5 h-7.75 border border-black text-foreground hover:bg-muted/10 rounded-lg text-xs font-montserrat-semibold transition-colors cursor-pointer"
		>
			Lihat detail
		</button>
	</div>
</div>
