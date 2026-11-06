<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { Project } from '$lib/features/projects/type';
	import Badge from '$lib/components/ui/Badge.svelte';
	import ProjectStatusNotice from './ProjectStatusNotice.svelte';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Link from 'phosphor-svelte/lib/Link';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Check from 'phosphor-svelte/lib/Check';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { formatRelativeTime } from '$lib/utils/date';
	import { useProjectLiveStatus } from '$lib/features/projects/detail/use-project-live-status.svelte';
	import { useProjectRedeploy } from '$lib/features/projects/detail/use-project-redeploy.svelte';
	import {
		getPortDisplay,
		getProjectPublicUrl,
		getPublicUrlLabel
	} from '$lib/features/projects/presentation';

	type Props = {
		project: Project;
	};

	let { project }: Props = $props();

	const live = useProjectLiveStatus(() => project);
	const redeploy = useProjectRedeploy(() => project);

	const header = $derived(live.header);
	const publicUrl = $derived(getProjectPublicUrl(project));
	const port = $derived(getPortDisplay(project));
	const showUrl = $derived(header.serving || header.showUrl === true);
	const isBusy = $derived(redeploy.isProcessing || header.redeployBusy);
	const hasMetaRow = $derived(header.kind !== 'not_deployed' && header.kind !== 'failed');

	let isCopied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function handleCopyUrl() {
		if (!publicUrl) return;
		navigator.clipboard?.writeText(publicUrl);
		isCopied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			isCopied = false;
		}, 2000);
	}
</script>

<div class="flex flex-col gap-8 mb-8">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-1.5">
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
				<h2 class="min-w-0 text-xl text-foreground wrap-anywhere">
					{project.name ?? project.project_name ?? 'Proyek'}
				</h2>
				<Badge tone={header.badge.variant}>
					{header.badge.label}
				</Badge>
			</div>
			<div
				class="flex flex-wrap items-center gap-x-2 text-sm text-foreground/80 font-mono mt-1 wrap-anywhere"
			>
				<span>{project.repository_full_name || 'Repository'}</span>
				<span>&bull;</span>
				<span>{project.branch || 'main'}</span>
			</div>
		</div>

		{#if header.showRedeploy}
			<div class="flex items-center">
				<Button onclick={redeploy.trigger} disabled={isBusy}>
					{#if isBusy}
						<CircleNotch size={18} weight="bold" class="animate-spin motion-reduce:animate-none" />
					{:else}
						<ArrowsClockwise size={18} weight="bold" />
					{/if}
					{#if header.redeployBusy}
						Sedang men-deploy
					{:else if header.kind === 'not_deployed'}
						Deploy sekarang
					{:else}
						Redeploy
					{/if}
				</Button>
			</div>
		{/if}
	</div>

	{#if redeploy.errorMessage}
		<p
			role="alert"
			class="rounded-control border border-error/30 bg-error-50 px-4 py-2.5 text-sm text-error-dark"
		>
			{redeploy.errorMessage}
		</p>
	{/if}

	{#if header.notice}
		<ProjectStatusNotice projectId={project.id} notice={header.notice} />
	{/if}

	{#if hasMetaRow}
		<div
			class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2.5 px-4 bg-background rounded-control border border-border"
		>
			<div class="flex items-center gap-3 min-w-0">
				{#if showUrl && publicUrl}
					<Link size={20} class="text-primary shrink-0" weight="bold" />
					<span class="text-primary font-semibold text-sm font-mono wrap-anywhere">
						<BreakableUrl text={getPublicUrlLabel(publicUrl)} />
					</span>
				{:else if showUrl}
					<Link size={20} class="text-muted shrink-0" weight="bold" />
					<span class="text-muted text-sm">URL publik belum tersedia</span>
				{:else}
					<Link size={20} class="text-muted shrink-0" weight="bold" />
					<span class="text-muted text-sm">Tidak ada URL yang melayani saat ini</span>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
				<div class="flex items-center gap-1.5">
					<span>Port</span>
					<span class="text-foreground font-semibold">{port.current}</span>
					{#if port.next !== null}
						<span class="text-xs">({port.next} berlaku di deploy berikutnya)</span>
					{/if}
				</div>
				<div class="flex items-center gap-1.5">
					<span>Deploy terakhir</span>
					<span class="text-foreground font-semibold">
						{project.last_deployed_at
							? formatRelativeTime(project.last_deployed_at)
							: 'Belum pernah'}
					</span>
				</div>

				{#if showUrl && publicUrl}
					<div class="flex items-center gap-2 md:ml-4">
						<Button
							variant="secondary"
							size="icon-sm"
							onclick={handleCopyUrl}
							aria-label="Salin URL"
							title={isCopied ? 'URL berhasil disalin' : 'Salin URL'}
						>
							{#if isCopied}
								<Check size={16} class="text-success" />
							{:else}
								<Copy size={16} />
							{/if}
						</Button>
						<Button
							variant="secondary"
							size="icon-sm"
							externalHref={publicUrl}
							aria-label="Buka situs"
						>
							<ArrowSquareOut size={16} aria-hidden="true" />
						</Button>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
