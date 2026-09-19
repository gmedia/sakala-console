<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { resolveRoute } from '$app/paths';
	import {
		ArrowSquareOut,
		ArrowsClockwise,
		Copy,
		Link,
		CircleNotch,
		Plus,
		WarningCircle,
		Check
	} from 'phosphor-svelte';
	import {
		createRedeployMutation,
		createUpdateProjectMutation
	} from '$lib/features/projects/mutations';
	import { getProjectDetailContext } from '$lib/features/projects/detail/projectDetailState.svelte';
	import { executeRedeployFlow } from '$lib/features/projects/detail/redeploy';
	import { runtimeStatusPresentation, toRuntimeStatus } from '$lib/features/projects/presentation';

	type Props = {
		project: Project;
	};

	let { project }: Props = $props();
	const detailState = getProjectDetailContext();

	let isCopied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function handleCopyUrl() {
		if (!project.default_domain) return;
		const url = project.default_domain.startsWith('http')
			? project.default_domain
			: `https://${project.default_domain}`;
		navigator.clipboard?.writeText(url);
		isCopied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			isCopied = false;
		}, 2000);
	}

	const runtimeStatus = $derived(toRuntimeStatus(project.runtime_status));

	const runtimePresentation = $derived(
		runtimeStatus
			? runtimeStatusPresentation[runtimeStatus]
			: {
					label: 'Lainnya',
					variant: 'neutral' as const
				}
	);

	const badgeTone = $derived.by(() => {
		if (project.status === 'failed') return 'error';
		if (project.status === 'suspended') return 'warning';
		if (project.status === 'draft') return 'neutral';

		return runtimePresentation.variant;
	});

	const displayStatus = $derived.by(() => {
		if (project.status === 'failed') return 'Gagal';
		if (project.status === 'suspended') return 'Suspended';
		if (project.status === 'draft') return 'Draft';

		return runtimePresentation.label;
	});

	const redeploy = createRedeployMutation();
	const updateProjectMutation = createUpdateProjectMutation();

	let isProcessing = $derived(redeploy.isPending || updateProjectMutation.isPending);

	async function handleRedeploy() {
		if (isProcessing) return;

		try {
			await executeRedeployFlow({
				project,
				detailState,
				updateProject: (payload) => updateProjectMutation.mutateAsync(payload),
				triggerRedeploy: (payload) => {
					redeploy.mutate(payload, {
						onError: (error) => {
							alert(error.message || 'Gagal melakukan redeploy. Silakan coba lagi.');
						}
					});
				}
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Gagal menyimpan perubahan pengaturan sebelum redeploy.';
			alert(message);
		}
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
					{project.name ?? project.project_name ?? 'Project'}
				</h1>
				<Badge tone={badgeTone} label={displayStatus} class="capitalize px-2 py-0.5"
					>{displayStatus}</Badge
				>
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
				disabled={isProcessing}
				class="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white h-10 px-4 rounded-lg font-medium transition-colors shadow-sm text-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
			>
				{#if isProcessing}
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
			<a
				href={resolveRoute('/(app)/projects/[id]/deployments', { id: project.id })}
				class="flex items-center justify-center px-3 h-8 bg-white border border-border rounded-lg hover:bg-muted/10 transition-colors font-montserrat-semibold text-xs whitespace-nowrap text-foreground"
			>
				Lihat riwayat
			</a>
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
					<span>Port</span>
					<span class="text-foreground font-semibold">
						{project.detected_port ? project.detected_port : 'Belum terdeteksi'}
					</span>
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
						type="button"
						onclick={handleCopyUrl}
						disabled={!project.default_domain}
						class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
						aria-label="Copy URL"
						title={isCopied ? 'URL berhasil disalin' : 'Salin URL'}
					>
						{#if isCopied}
							<Check size={16} class="text-success" />
						{:else}
							<Copy size={16} />
						{/if}
					</button>
					<a
						href="https://{project.default_domain}"
						target="_blank"
						rel="noreferrer"
						class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm {project.default_domain
							? ''
							: 'pointer-events-none opacity-50'}"
						aria-label="Open external link"
					>
						<ArrowSquareOut size={16} />
					</a>
				</div>
			</div>
		</div>
	{/if}
</div>
