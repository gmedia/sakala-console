<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import type { Project } from '$lib/features/projects/type';
	import Badge from '$lib/components/ui/Badge.svelte';
	import AutoDeployPausedBanner from './AutoDeployPausedBanner.svelte';
	import ProjectStatusNotice from './ProjectStatusNotice.svelte';
	import RedeployButton from './RedeployButton.svelte';
	import RestartProjectDialog from './RestartProjectDialog.svelte';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Copy from 'phosphor-svelte/lib/Copy';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Check from 'phosphor-svelte/lib/Check';
	import Moon from 'phosphor-svelte/lib/Moon';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { ABUSE_EMAIL } from '$lib/config/project';
	import { copyWithToast, URL_COPY_MESSAGES } from '$lib/utils/clipboard';
	import { useProjectLiveStatus } from '$lib/features/projects/detail/use-project-live-status.svelte';
	import { useProjectRedeploy } from '$lib/features/projects/detail/use-project-redeploy.svelte';
	import { useProjectWake } from '$lib/features/projects/detail/use-project-wake.svelte';
	import { useProjectRestart } from '$lib/features/projects/detail/use-project-restart.svelte';
	import { RESTART_COPY } from '$lib/features/projects/restart';
	import {
		FILE_STORAGE_COPY,
		projectFileStorageGuideUrl
	} from '$lib/features/projects/file-storage';
	import FileStorageGuideLink from '../project/FileStorageGuideLink.svelte';
	import { useProjectIdleWindow } from '$lib/features/projects/detail/use-project-idle-window.svelte';
	import {
		getPortDisplay,
		getProjectPublicUrl,
		getPublicUrlLabel,
		lastDeployTime,
		PROJECT_WAKE_COPY,
		REDEPLOY_COPY,
		servesStaticFiles
	} from '$lib/features/projects/presentation';
	import { useProjectAccess } from '$lib/features/workspaces/access.svelte';
	import {
		limitsWorkspaceId,
		ROLE_LABELS,
		workspaceLabel
	} from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { canOfferProjectBucket } from '$lib/features/buckets/presentation';
	import CreateProjectBucketLink from '$lib/features/buckets/components/CreateProjectBucketLink.svelte';

	type Props = {
		project: Project;
	};

	let { project }: Props = $props();

	const access = useProjectAccess(() => project);
	const idleWindow = useProjectIdleWindow(
		() => project,
		() => access.role !== null
	);
	const live = useProjectLiveStatus(
		() => project,
		() => ({ idleSleepMinutes: idleWindow.minutes })
	);
	const redeploy = useProjectRedeploy(() => project);
	const wake = useProjectWake(() => project);
	const restart = useProjectRestart(
		() => project,
		() => live.restartOutcome
	);

	const header = $derived(live.header);
	const publicUrl = $derived(getProjectPublicUrl(project));
	const port = $derived(getPortDisplay(project));
	// A static site has no port of its own: the number would be Sakala's file server.
	const showPort = $derived(!servesStaticFiles(project));
	const lastDeploy = $derived(lastDeployTime(project));
	const showUrl = $derived(header.serving || header.showUrl === true);
	const isBusy = $derived(redeploy.isProcessing || header.redeployBusy);
	const hasFacts = $derived(header.kind !== 'not_deployed' && header.kind !== 'failed');

	const autoDeployPause = $derived(project.auto_deploy_pause ?? null);
	// While paused, the live version is a rollback, and Redeploy replaces it with the branch's newest.
	const redeployLabel = $derived(
		header.redeployBusy
			? REDEPLOY_COPY.otherDeploymentRunning
			: header.kind === 'not_deployed'
				? REDEPLOY_COPY.firstDeploy
				: autoDeployPause
					? REDEPLOY_COPY.pausedAction
					: REDEPLOY_COPY.action
	);
	// In the Redeploy menu while it runs or crash-loops, and while a restart waits for its node.
	const restartOption = $derived(
		restart.available || restart.pending
			? { pending: restart.pending, onSelect: restart.openDialog }
			: null
	);
	// A full build is only a choice next to a live image; without one, every redeploy builds.
	const canForceBuild = $derived(
		header.kind !== 'not_deployed' && Boolean(project.active_deployment_id)
	);

	const suspensionReason = $derived(project.suspension?.reason ?? null);
	// A static site keeps no files of its own, so the clause would only worry its owner.
	const showSleepingFileNote = $derived(header.kind === 'sleeping' && !servesStaticFiles(project));
	// Beside that note, a way out when the workspace is opened for buckets and the project has none.
	const bucketLimitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project.workspace),
		() => ({
			enabled: showSleepingFileNote && !access.readOnly && project.buckets?.length === 0
		})
	);
	const offerBucket = $derived(
		showSleepingFileNote &&
			!access.readOnly &&
			project.buckets?.length === 0 &&
			canOfferProjectBucket(bucketLimitsQuery.data)
	);

	let isCopied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function handleCopyUrl() {
		if (!publicUrl || !(await copyWithToast(publicUrl, URL_COPY_MESSAGES))) return;
		isCopied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			isCopied = false;
		}, 2000);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
		<div class="flex min-w-0 flex-1 basis-72 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<Badge tone={header.badge.variant}>
					{header.badge.label}
				</Badge>
				{#if header.activity}
					<Badge tone={header.activity.variant}>
						<span data-testid="project-header-activity">{header.activity.label}</span>
					</Badge>
				{/if}
				{#if restart.pending}
					<Badge tone="running">
						<span data-testid="project-restart-pending">{RESTART_COPY.pending}</span>
					</Badge>
				{/if}
				{#if header.replicaHealth}
					<Badge tone={header.replicaHealth.tone} class="tabular-nums">
						<span data-testid="project-replica-health">{header.replicaHealth.label}</span>
					</Badge>
				{/if}
				{#if showUrl && publicUrl}
					<div class="flex min-w-0 items-center gap-1.5">
						<a
							href={publicUrl}
							target="_blank"
							rel="external noopener noreferrer"
							class="min-w-0 font-mono text-base font-medium wrap-anywhere text-primary-dark underline underline-offset-2 sm:text-xl"
							data-testid="project-public-url"
						>
							<BreakableUrl text={getPublicUrlLabel(publicUrl)} />
						</a>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={handleCopyUrl}
							aria-label="Salin URL"
							title={isCopied ? 'URL berhasil disalin' : 'Salin URL'}
						>
							{#if isCopied}
								<Check size={16} class="text-success" aria-hidden="true" />
							{:else}
								<Copy size={16} aria-hidden="true" />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							externalHref={publicUrl}
							aria-label="Buka situs"
							title="Buka situs"
						>
							<ArrowSquareOut size={16} aria-hidden="true" />
						</Button>
					</div>
				{:else if showUrl}
					<span class="text-sm text-muted">URL publik belum tersedia</span>
				{:else if hasFacts && header.kind !== 'suspended'}
					<span class="text-sm text-muted">Situs belum bisa dibuka</span>
				{/if}
			</div>

			<dl class="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted">
				<div class="flex min-w-0 items-baseline gap-1.5">
					<dt class="sr-only">Repository</dt>
					<dd class="min-w-0 font-mono wrap-anywhere">
						{project.repository_full_name || 'Repository'}
					</dd>
				</div>
				<div class="flex min-w-0 items-baseline gap-1.5">
					<dt>Branch</dt>
					<dd class="min-w-0 font-mono wrap-anywhere text-foreground">
						{project.branch || 'main'}
					</dd>
				</div>
				{#if project.workspace && (access.hasTeams || project.workspace.type === 'team')}
					<div class="flex min-w-0 items-baseline gap-1.5" data-testid="project-workspace">
						<dt>Workspace</dt>
						<dd class="min-w-0 wrap-anywhere text-foreground">
							{workspaceLabel(project.workspace)}
						</dd>
					</div>
				{/if}
				{#if hasFacts}
					{#if showPort}
						<div class="flex items-baseline gap-1.5" data-testid="project-header-port">
							<dt>Port</dt>
							<dd class="text-foreground tabular-nums">
								<span>{port.current}</span>
								{#if port.next !== null}
									<span class="text-xs text-muted">({port.next} berlaku di deploy berikutnya)</span>
								{/if}
							</dd>
						</div>
					{/if}
					<div class="flex items-baseline gap-1.5">
						<dt>Deploy terakhir</dt>
						<dd class="text-foreground">
							{#if lastDeploy}
								<time datetime={lastDeploy.at}>{lastDeploy.label}</time>
							{:else}
								Belum pernah
							{/if}
						</dd>
					</div>
				{/if}
			</dl>
		</div>

		{#if !access.readOnly && (header.showWake || header.showRedeploy)}
			<div class="flex flex-wrap gap-2 max-sm:w-full">
				{#if header.showWake}
					<Button class="max-sm:w-full" onclick={wake.trigger} disabled={wake.isWaking}>
						{#if wake.isWaking}
							<CircleNotch
								size={18}
								weight="bold"
								class="animate-spin motion-reduce:animate-none"
								aria-hidden="true"
							/>
							{PROJECT_WAKE_COPY.busy}
						{:else}
							<Moon size={18} weight="bold" aria-hidden="true" />
							{PROJECT_WAKE_COPY.action}
						{/if}
					</Button>
				{/if}
				{#if header.showRedeploy}
					<RedeployButton
						class="max-sm:w-full"
						variant={header.showWake ? 'secondary' : 'primary'}
						onRedeploy={redeploy.trigger}
						disabled={isBusy}
						busy={isBusy}
						label={redeployLabel}
						offerForceBuild={canForceBuild}
						restart={restartOption}
					/>
				{/if}
			</div>
		{/if}
	</div>

	{#if access.readOnly && access.role}
		<p
			class="rounded-control border border-info/20 bg-info/10 px-4 py-2.5 text-sm text-foreground"
			data-testid="read-only-notice"
		>
			Kamu {ROLE_LABELS[access.role].toLowerCase()} di workspace {access.workspace?.name}, jadi
			halaman proyek ini hanya bisa dilihat. Nilai secret disembunyikan, dan deploy serta perubahan
			pengaturan dilakukan pemilik atau anggota workspace.
		</p>
	{/if}

	{#if wake.errorMessage}
		<p
			role="alert"
			class="rounded-control border border-error/30 bg-error-50 px-4 py-2.5 text-sm text-error-dark"
		>
			{wake.errorMessage}
		</p>
	{/if}

	{#if restart.failureMessage}
		<p
			role="alert"
			class="rounded-control border border-error/30 bg-error-50 px-4 py-2.5 text-sm text-error-dark"
		>
			{restart.failureMessage}
		</p>
	{/if}

	{#if redeploy.errorMessage}
		<p
			role="alert"
			class="rounded-control border border-error/30 bg-error-50 px-4 py-2.5 text-sm text-error-dark"
		>
			{redeploy.errorMessage}
		</p>
	{/if}

	{#if header.notice}
		<ProjectStatusNotice projectId={project.id} notice={header.notice}>
			{#if header.kind === 'suspended'}
				<p data-testid="suspension-reason" class="wrap-anywhere">
					{#if suspensionReason}
						Alasannya: {suspensionReason}
					{:else}
						Alasannya tertulis di notifikasi dan email yang dikirim ke pemilik proyek.
					{/if}
				</p>
				<p>
					Kalau menurutmu keputusan ini keliru, kirim email ke
					<a
						href={`mailto:${ABUSE_EMAIL}`}
						class="font-medium text-primary-dark underline underline-offset-2">{ABUSE_EMAIL}</a
					>.
				</p>
			{:else if showSleepingFileNote}
				<p class="text-muted" data-testid="sleeping-file-note">
					{FILE_STORAGE_COPY.sleeping}
					{#if offerBucket}
						<span class="flex flex-wrap gap-x-4 gap-y-1">
							<FileStorageGuideLink href={projectFileStorageGuideUrl(project.stack)} />
							<CreateProjectBucketLink projectId={project.id} />
						</span>
					{:else}
						<FileStorageGuideLink href={projectFileStorageGuideUrl(project.stack)} />
					{/if}
				</p>
			{/if}
		</ProjectStatusNotice>
	{/if}

	{#if autoDeployPause}
		<AutoDeployPausedBanner
			{project}
			pause={autoDeployPause}
			canResume={!access.readOnly}
			workspaceName={project.workspace?.name}
		/>
	{/if}
</div>

<RestartProjectDialog
	open={restart.dialogOpen}
	crashed={project.runtime_status === 'crashed'}
	isLoading={restart.isSubmitting}
	error={restart.errorMessage}
	onConfirm={restart.confirm}
	onClose={restart.closeDialog}
/>
