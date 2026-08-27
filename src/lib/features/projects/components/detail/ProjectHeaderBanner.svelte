<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import Badge from '$lib/components/ui/Badge.svelte';
	import {
		ArrowSquareOut,
		ArrowsClockwise,
		Copy,
		Link,
		CircleNotch,
		Plus,
		WarningCircle
	} from 'phosphor-svelte';
	import { createRedeployMutation } from '$lib/features/projects/mutations';

	type Props = {
		project: Project;
	};

	let { project }: Props = $props();

	let badgeTone = $derived.by<'success' | 'error' | 'warning' | 'info' | 'neutral'>(() => {
		if (project.runtime_status === 'not_deployed') return 'neutral';
		if (project.status !== 'ready') {
			if (project.status === 'failed') return 'error';
			return 'warning';
		}

		switch (project.runtime_status) {
			case 'running':
				return 'success';
			case 'failed':
			case 'crashed':
				return 'error';
			case 'deploying':
				return 'info';
			default:
				return 'neutral';
		}
	});

	let displayStatus = $derived.by(() => {
		if (project.runtime_status === 'not_deployed') return 'Belum deploy';
		if (project.status === 'failed' || project.runtime_status === 'failed') return 'Failed';
		return project.status === 'ready' ? project.runtime_status.replace('_', ' ') : project.status;
	});

	const redeploy = createRedeployMutation();

	function handleRedeploy() {
		redeploy.mutate(
			{ projectId: project.id, idempotencyKey: crypto.randomUUID() },
			{
				onError: (error) => {
					alert(error.message || 'Gagal melakukan redeploy. Silakan coba lagi.');
				}
			}
		);
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
		if (diffDays < 7) return `${diffDays} hari lalu`;

		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}
</script>

<div class="flex flex-col gap-8 mb-8">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div class="flex flex-col gap-1.5">
			<div class="flex items-center gap-3">
				<h1 class="text-[22px] font-sans font-semibold tracking-tight text-foreground leading-none">
					{project.project_name}
				</h1>
				<Badge tone={badgeTone} class="capitalize px-2 py-0.5">{displayStatus}</Badge>
			</div>
			<div class="flex items-center gap-2 text-sm text-foreground/80 font-mono mt-1">
				<span>{project.repository_full_name || 'Repository'}</span>
				<span>&bull;</span>
				<span>{project.branch || 'main'}</span>
			</div>
		</div>

		<div class="flex items-center">
			<button
				onclick={handleRedeploy}
				disabled={redeploy.isPending}
				class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white h-10 px-4 rounded-lg font-medium transition-colors shadow-sm text-sm disabled:opacity-70 disabled:cursor-not-allowed"
			>
				{#if redeploy.isPending}
					<CircleNotch size={18} weight="bold" class="animate-spin" />
				{:else if project.runtime_status === 'not_deployed'}
					<Plus size={18} weight="bold" />
				{:else}
					<ArrowsClockwise size={18} weight="bold" />
				{/if}
				{project.runtime_status === 'not_deployed' ? 'Deploy sekarang' : 'Redeploy'}
			</button>
		</div>
	</div>

	{#if project.runtime_status === 'not_deployed'}
		<div
			class="flex items-center gap-2.5 py-3.5 px-4 bg-white rounded-lg border border-border/80 text-sm text-muted shadow-sm"
		>
			<Link size={18} class="text-foreground" />
			<span>Belum ada deployment. Jalankan deploy pertamamu untuk mendapatkan URL publik.</span>
		</div>
	{:else if project.runtime_status === 'failed' || project.status === 'failed'}
		<div
			class="flex flex-col md:flex-row md:items-center justify-between py-3 px-4 bg-white rounded-lg border border-border/80 text-foreground"
		>
			<div class="flex items-center gap-2">
				<WarningCircle size={24} class="text-error" weight="regular" />
				<span class="font-montserrat text-sm">
					Deploy gagal, belum ada URL publik yang aktif. Cek log build untuk lihat penyebabnya.
				</span>
			</div>
			<button
				class="flex items-center justify-center w-18 h-8 bg-white border border-black rounded-lg hover:bg-muted/10 transition-colors font-montserrat-semibold text-xs whitespace-nowrap"
			>
				Lihat log
			</button>
		</div>
	{:else}
		<div
			class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2.5 px-4 bg-background rounded-lg border border-border/80"
		>
			<div class="flex items-center gap-3 overflow-hidden">
				<Link size={20} class="text-primary" weight="bold" />
				<span class="text-primary font-semibold text-sm tracking-wide font-mono">
					{project.default_domain || 'Menunggu URL Publik...'}
				</span>
			</div>

			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
				<div class="flex items-center gap-1.5">
					<span>Framework</span>
					<!-- still hardcode, currently there's no 'framework' data in sakala-api -->
					<span class="text-foreground font-semibold">Node.js</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span>Port</span>
					<span class="text-foreground font-semibold">{project.detected_port || '3000'}</span>
				</div>
				<div class="flex items-center gap-1.5">
					<span>Deploy terakhir</span>
					<span class="text-foreground font-semibold">
						{project.last_deployed_at
							? formatRelativeTime(project.last_deployed_at)
							: 'Belum pernah'}
					</span>
				</div>

				<div class="flex items-center gap-2 md:ml-4">
					<button
						class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm"
						aria-label="Copy URL"
					>
						<Copy size={16} />
					</button>
					<a
						href="https://{project.default_domain}"
						target="_blank"
						rel="noreferrer"
						class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm"
						aria-label="Open external link"
					>
						<ArrowSquareOut size={16} />
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>
