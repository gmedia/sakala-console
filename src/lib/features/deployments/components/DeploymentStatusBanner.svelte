<script lang="ts">
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Copy from 'phosphor-svelte/lib/Copy';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import type { ResolvedPathname } from '$app/types';
	import {
		getRecoveryHintLabel,
		getStatusDisplay,
		type BannerStatus,
		type QueueState,
		type ServingState
	} from '../status-config';
	import { getPublicUrlLabel } from '$lib/features/projects/presentation';
	import { copyWithToast, URL_COPY_MESSAGES } from '$lib/utils/clipboard';
	import { cn } from '$lib/utils/cn';

	type Props = {
		status: BannerStatus;
		currentStepLabel?: string;
		durationLabel?: string;
		failedStepLabel?: string;
		failureCategory?: string;
		failureCode?: string;
		failureSummary?: string;
		failureDetail?: string;
		userFixable?: boolean;
		recoveryHint?: string;
		servingState?: ServingState;
		queueState?: QueueState | null;
		cancelRequested?: boolean;
		publicUrl?: string | null;
		/** Set on the first deployment of a project to go live, which gets its own moment. */
		firstLiveProjectName?: string | null;
		/** Where the state of the running app can be read, when this deployment is not healthy. */
		projectHref?: ResolvedPathname;
		onViewError?: () => void;
		onRedeploy?: () => void;
		onCancel?: () => void;
		redeployPending?: boolean;
		redeployDisabled?: boolean;
		redeployError?: string;
		redeployBlockedReason?: string;
	};

	let {
		status,
		currentStepLabel,
		durationLabel,
		failedStepLabel,
		failureCategory,
		failureCode,
		failureSummary,
		failureDetail,
		userFixable,
		recoveryHint,
		servingState = 'live',
		queueState,
		cancelRequested = false,
		publicUrl = null,
		firstLiveProjectName = null,
		projectHref,
		onViewError,
		onRedeploy,
		onCancel,
		redeployPending = false,
		redeployDisabled = false,
		redeployError = '',
		redeployBlockedReason
	}: Props = $props();

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let display = $derived(
		getStatusDisplay({
			status,
			currentStepLabel,
			durationLabel,
			failedStepLabel,
			failureCategory,
			failureSummary,
			userFixable,
			servingState,
			queueState,
			cancelRequested
		})
	);

	let displayUrl = $derived(publicUrl ? getPublicUrlLabel(publicUrl) : null);
	let isLive = $derived(status === 'success' && servingState === 'live');
	let isUnhealthy = $derived(
		status === 'success' && (servingState === 'crash_looping' || servingState === 'not_serving')
	);
	let isFirstLive = $derived(isLive && Boolean(firstLiveProjectName && publicUrl && displayUrl));
	let hasFailureDetails = $derived(
		status === 'failed' && Boolean(failureCode || failureDetail || recoveryHint)
	);
	let canRedeploy = $derived(status === 'failed' || status === 'cancelled');

	async function copyToClipboard() {
		if (!publicUrl || !(await copyWithToast(publicUrl, URL_COPY_MESSAGES))) return;
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

{#snippet copyButton(size: 'icon' | 'md')}
	<Button
		variant="secondary"
		{size}
		onclick={copyToClipboard}
		aria-label={copied ? 'Tersalin' : 'Salin URL'}
		title={copied ? 'URL berhasil disalin' : 'Salin URL'}
	>
		{#if copied}
			<Check size={18} class="text-primary" aria-hidden="true" />
		{:else}
			<Copy size={18} aria-hidden="true" />
		{/if}
		{#if size === 'md'}
			{copied ? 'Tersalin' : 'Salin'}
		{/if}
	</Button>
{/snippet}

{#if isFirstLive && publicUrl && displayUrl}
	<!-- The one loud thing on this page. It only happens once per project, and nothing here is invented. -->
	<section data-testid="first-live" class="rounded-card bg-primary-50 p-5 sm:p-6">
		<div class="flex items-start gap-4">
			<span class="max-sm:hidden"
				><StatusIndicator status="success" size="xl" showLabel={false} /></span
			>
			<div class="min-w-0 flex-1">
				<h2 class="text-2xl wrap-anywhere text-foreground sm:text-3xl">
					{firstLiveProjectName} sudah live
				</h2>
				<p class="mt-1 text-sm text-foreground">
					Alamat ini sudah bisa kamu bagikan ke siapa saja. Selamat atas deploy pertamanya.
				</p>
				<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
					<a
						href={publicUrl}
						target="_blank"
						rel="external noopener noreferrer"
						class="min-w-0 font-mono text-xl wrap-anywhere text-primary-dark underline underline-offset-4 sm:text-2xl"
					>
						<BreakableUrl text={displayUrl} />
					</a>
					<div class="flex flex-wrap items-center gap-2">
						<Button externalHref={publicUrl}>
							Buka situs
							<ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
						</Button>
						{@render copyButton('md')}
					</div>
				</div>
			</div>
		</div>
	</section>
{:else}
	<section class={cn('rounded-card p-4', display.bannerBgClass)}>
		<div class="flex flex-wrap items-start gap-x-3 gap-y-3">
			<div class="flex min-w-0 flex-1 basis-72 items-start gap-3">
				<StatusIndicator
					{status}
					size="lg"
					showLabel={false}
					colorClassOverride={display.iconColorClass}
					animateIcon
				/>
				<div class="min-w-0">
					<h2 class="text-base text-foreground">{display.title}</h2>
					<p class="mt-0.5 text-sm text-foreground">{display.desc}</p>
				</div>
			</div>

			{#if status === 'running' && onCancel && !cancelRequested}
				<Button variant="secondary" class="whitespace-nowrap" onclick={onCancel}>
					<XCircle size={16} weight="bold" aria-hidden="true" />
					Batalkan deployment
				</Button>
			{/if}

			{#if isUnhealthy && projectHref}
				<Button variant="secondary" href={projectHref}>Lihat status proyek</Button>
			{/if}

			{#if isLive && publicUrl && displayUrl}
				<div class="flex max-w-full min-w-0 flex-wrap items-center gap-2">
					<a
						href={publicUrl}
						target="_blank"
						rel="external noopener noreferrer"
						class="min-w-0 font-mono text-sm wrap-anywhere text-primary-dark underline underline-offset-2"
					>
						<BreakableUrl text={displayUrl} />
					</a>
					{@render copyButton('icon')}
					<Button externalHref={publicUrl} class="whitespace-nowrap">
						Kunjungi situs
						<ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
					</Button>
				</div>
			{/if}

			{#if canRedeploy && (onViewError || onRedeploy)}
				<div class="flex flex-wrap items-center gap-2">
					{#if onViewError && status === 'failed'}
						<Button variant="secondary" onclick={onViewError}>
							<MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
							Lihat error di log
						</Button>
					{/if}
					{#if onRedeploy}
						<Button
							disabled={redeployPending || redeployDisabled}
							aria-busy={redeployPending}
							onclick={onRedeploy}
						>
							{#if redeployPending}
								<CircleNotch
									size={16}
									weight="bold"
									class="animate-spin motion-reduce:animate-none"
								/>
								Menjalankan...
							{:else}
								<ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
								Redeploy
							{/if}
						</Button>
					{/if}
				</div>
			{/if}
		</div>

		{#if isLive && !publicUrl}
			<p class="mt-2 text-sm text-foreground">URL publik proyek ini belum tersedia.</p>
		{/if}

		{#if redeployBlockedReason && canRedeploy}
			<p class="mt-2 text-sm text-foreground">{redeployBlockedReason}</p>
		{/if}

		{#if redeployError}
			<p
				role="alert"
				class="mt-3 rounded-control border border-error/30 bg-background px-4 py-2 text-sm text-error-dark"
			>
				{redeployError}
			</p>
		{/if}

		{#if hasFailureDetails}
			<div
				id="failure-summary"
				class={cn(
					'mt-3 grid gap-x-4 gap-y-2 rounded-control border border-error/30 bg-surface p-3',
					failureDetail && 'lg:grid-cols-2'
				)}
			>
				<div class="min-w-0 space-y-2">
					{#if recoveryHint}
						<p class="text-sm wrap-anywhere text-foreground">
							<span class="font-semibold">{getRecoveryHintLabel(userFixable)}</span>
							{recoveryHint}
						</p>
					{/if}
					{#if failureCode}
						<p class="text-xs text-muted">
							Kode <span class="font-mono wrap-anywhere">{failureCode}</span>
						</p>
					{/if}
				</div>

				{#if failureDetail}
					<div class="min-w-0">
						<p class="sr-only">Detail error</p>
						<pre
							class="max-h-24 overflow-auto rounded-control bg-terminal p-2 font-mono text-xs wrap-anywhere whitespace-pre-wrap text-terminal-text">{failureDetail}</pre>
					</div>
				{/if}
			</div>
		{/if}
	</section>
{/if}
