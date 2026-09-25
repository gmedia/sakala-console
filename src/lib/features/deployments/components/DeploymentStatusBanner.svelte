<script lang="ts">
	import StatusIndicator from '$lib/components/ui/StatusIndicator.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Check, Copy, ArrowSquareOut, MagnifyingGlass, WarningCircle } from 'phosphor-svelte';
	import { getStatusDisplay, type BannerStatus } from '../status-config';
	import { cn } from '$lib/utils/cn';

	type Props = {
		status: BannerStatus;
		currentStepLabel?: string;
		durationLabel?: string;
		failedStepLabel?: string;
		failureCode?: string;
		failureSummary?: string;
		recoveryHint?: string;
		publicUrl?: string | null;
		onViewError?: () => void;
	};

	let {
		status,
		currentStepLabel,
		durationLabel,
		failedStepLabel,
		failureCode,
		failureSummary,
		recoveryHint,
		publicUrl = null,
		onViewError
	}: Props = $props();

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	let display = $derived(
		getStatusDisplay({ status, currentStepLabel, durationLabel, failedStepLabel })
	);

	let descColorClass = $derived(
		cn(
			'text-muted',
			status === 'running' && 'text-warning-dark',
			status === 'failed' && 'text-error',
			status === 'success' && 'text-success'
		)
	);

	let displayUrl = $derived(publicUrl ? publicUrl.replace(/^https?:\/\//, '') : null);
	let hasFailureDetails = $derived(
		status === 'failed' && Boolean(failureCode || failureSummary || recoveryHint)
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

<div class="rounded-lg p-4 mt-2 flex items-start gap-3 font-montserrat {display.bannerBgClass}">
	<StatusIndicator
		{status}
		size="xl"
		showLabel={false}
		colorClassOverride={display.iconColorClass}
		animateIcon
	/>

	<div class="flex-1 min-w-0">
		<div class="flex items-start justify-between gap-3">
			<div class="flex-1 min-w-0">
				<h2 class="font-semibold">{display.title}</h2>
				<p class="text-sm font-normal {descColorClass}">{display.desc}</p>
			</div>

			{#if status === 'failed' && onViewError}
				<div class="shrink-0">
					<Button
						variant="outline"
						class="border border-muted/30 bg-background hover:bg-muted/10"
						onclick={onViewError}
					>
						<MagnifyingGlass size={16} weight="bold" />
						Lihat detail error
					</Button>
				</div>
			{/if}
		</div>

		{#if hasFailureDetails}
			<div id="failure-summary" class="mt-3 rounded-lg border border-error/30 bg-background p-4">
				<div class="flex items-center gap-2">
					{#if failureCode}
						<span
							class="inline-flex items-center rounded border border-error/40 px-2 py-0.5 font-jetbrains-mono text-xs text-error"
						>
							{failureCode}
						</span>
					{/if}
					<span class="font-montserrat-semibold text-xs uppercase tracking-wide text-muted">
						Ringkasan
					</span>
				</div>

				{#if failureSummary}
					<p class="mt-2 text-sm font-montserrat text-foreground">{failureSummary}</p>
				{/if}

				{#if recoveryHint}
					<div
						class="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3"
					>
						<WarningCircle size={18} weight="fill" class="mt-0.5 shrink-0 text-warning-dark" />
						<p class="text-sm font-montserrat text-foreground">
							<span class="font-semibold">Cara memperbaiki: </span>{recoveryHint}
						</p>
					</div>
				{/if}
			</div>
		{/if}

		{#if status === 'success' && publicUrl && displayUrl}
			<div class="mt-3 flex items-center justify-between gap-3 w-full">
				<div class="flex items-center gap-2 min-w-0">
					<div class="shrink-0 rounded-lg border border-primary bg-background px-3 py-2">
						<a
							href={publicUrl}
							target="_blank"
							rel="external noopener noreferrer"
							class="block truncate text-primary font-jetbrains-mono-semibold hover:underline"
							title={publicUrl}
						>
							{displayUrl}
						</a>
					</div>

					<Button
						class="shrink-0 border border-primary bg-background p-2"
						variant="outline"
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
					class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-muted/30 bg-primary px-4 py-2.5 font-montserrat-semibold text-sm text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				>
					Kunjungi situs
					<ArrowSquareOut size={18} weight="bold" />
				</a>
			</div>
		{/if}
	</div>
</div>
