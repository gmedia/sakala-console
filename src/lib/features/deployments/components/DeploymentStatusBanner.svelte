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
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import {
		getRecoveryHintLabel,
		getStatusDisplay,
		type BannerStatus,
		type QueueState,
		type ServingState
	} from '../status-config';
	import { getPublicUrlLabel } from '$lib/features/projects/presentation';
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
			userFixable,
			servingState,
			queueState,
			cancelRequested
		})
	);

	let descColorClass = $derived(
		cn(
			'text-muted',
			status === 'running' && 'text-foreground',
			status === 'failed' && 'text-error',
			status === 'success' && 'text-success-dark',
			status === 'cancelled' && 'text-foreground/80'
		)
	);

	let displayUrl = $derived(publicUrl ? getPublicUrlLabel(publicUrl) : null);
	let hasFailureDetails = $derived(
		status === 'failed' && Boolean(failureCode || failureSummary || failureDetail || recoveryHint)
	);

	function copyToClipboard() {
		if (!publicUrl) return;
		navigator.clipboard?.writeText(publicUrl);
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="rounded-control p-4 mt-2 {display.bannerBgClass}">
	<div class="flex items-start gap-3">
		<StatusIndicator
			{status}
			size="xl"
			showLabel={false}
			colorClassOverride={display.iconColorClass}
			animateIcon
		/>

		<div class="flex-1 min-w-0">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-48 flex-1">
					<h2 class="font-semibold">{display.title}</h2>
					<p class="text-sm font-normal {descColorClass}">{display.desc}</p>
				</div>

				{#if status === 'running' && onCancel && !cancelRequested}
					<Button variant="secondary" onclick={onCancel}>
						<XCircle size={16} weight="bold" />
						Batalkan deployment
					</Button>
				{/if}

				{#if (status === 'failed' || status === 'cancelled') && (onViewError || onRedeploy)}
					<div class="flex flex-wrap items-center gap-2">
						{#if onViewError && status === 'failed'}
							<Button variant="secondary" onclick={onViewError}>
								<MagnifyingGlass size={16} weight="bold" />
								Lihat detail error
							</Button>
						{/if}
						{#if onRedeploy}
							<Button
								variant={status === 'failed' ? 'danger' : 'primary'}
								disabled={redeployPending || redeployDisabled}
								aria-busy={redeployPending}
								onclick={onRedeploy}
							>
								{#if redeployPending}
									<CircleNotch size={16} weight="bold" class="animate-spin" />
									Menjalankan...
								{:else}
									<ArrowsClockwise size={16} weight="bold" />
									Redeploy
								{/if}
							</Button>
						{/if}
					</div>
				{/if}
			</div>

			{#if redeployBlockedReason && (status === 'failed' || status === 'cancelled')}
				<p class="mt-3 text-sm text-foreground">{redeployBlockedReason}</p>
			{/if}

			{#if redeployError}
				<p
					role="alert"
					class="mt-3 rounded-control border border-error/30 bg-background px-4 py-2 text-sm text-error-dark"
				>
					{redeployError}
				</p>
			{/if}
		</div>
	</div>

	<div class="sm:ml-15">
		{#if hasFailureDetails}
			<div
				id="failure-summary"
				tabindex="-1"
				class="mt-3 scroll-mt-4 rounded-control border border-error/30 bg-background p-4 focus:ring-2 focus:ring-error focus:outline-none"
			>
				<div class="flex flex-wrap items-center gap-2">
					{#if failureCode}
						<span
							class="inline-flex items-center rounded-control border border-error/40 px-2 py-0.5 font-mono text-xs wrap-anywhere text-error"
						>
							{failureCode}
						</span>
					{/if}
					<span class="font-semibold text-xs text-muted"> Ringkasan </span>
				</div>

				{#if failureSummary}
					<p class="mt-2 text-sm text-foreground">{failureSummary}</p>
				{/if}

				{#if failureDetail}
					<div class="mt-3">
						<p class="font-semibold text-xs text-muted">Detail error</p>
						<pre
							class="mt-1 rounded-control bg-terminal p-3 font-mono text-xs whitespace-pre-wrap wrap-anywhere text-terminal-text">{failureDetail}</pre>
					</div>
				{/if}

				{#if recoveryHint}
					<div
						class="mt-3 flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 p-3"
					>
						<WarningCircle size={18} weight="fill" class="mt-0.5 shrink-0 text-warning-dark" />
						<p class="min-w-0 text-sm wrap-anywhere text-foreground">
							<span class="font-semibold">{getRecoveryHintLabel(userFixable)}</span>
							{recoveryHint}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if status === 'success' && servingState === 'live' && publicUrl && displayUrl}
			<div class="mt-3 flex w-full flex-wrap items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<div class="min-w-0 rounded-control border border-primary bg-background px-3 py-2">
						<a
							href={publicUrl}
							target="_blank"
							rel="external noopener noreferrer"
							class="block wrap-anywhere text-primary font-mono font-semibold hover:underline"
						>
							<BreakableUrl text={displayUrl} />
						</a>
					</div>

					<Button
						variant="secondary"
						size="icon"
						onclick={copyToClipboard}
						aria-label={copied ? 'Tersalin' : 'Salin URL'}
						title={copied ? 'URL berhasil disalin' : 'Salin URL'}
					>
						{#if copied}
							<Check class="h-5 w-5 text-primary" />
						{:else}
							<Copy class="h-5 w-5 text-muted" />
						{/if}
					</Button>
				</div>

				<a
					href={publicUrl}
					target="_blank"
					rel="external noopener noreferrer"
					class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-control border border-primary bg-primary px-4 py-2.5 font-semibold text-sm text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				>
					Kunjungi situs
					<ArrowSquareOut size={18} weight="bold" />
				</a>
			</div>
		{:else if status === 'success' && servingState === 'live'}
			<p class="mt-3 text-sm text-foreground">URL publik proyek ini belum tersedia.</p>
		{/if}
	</div>
</div>
