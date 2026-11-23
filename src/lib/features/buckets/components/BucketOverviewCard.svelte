<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Warning from 'phosphor-svelte/lib/Warning';
	import type { Bucket } from '$lib/api/resources/buckets';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import {
		BUCKET_COPY,
		FULL_COPY,
		bucketStatusView,
		bucketUsageMeter,
		formatMegabytes,
		isBucketFull,
		isOnNode,
		pendingQuotaText,
		provisioningSteps,
		separateFailure
	} from '../presentation';
	import BucketStatusBadge from './BucketStatusBadge.svelte';

	let { bucket }: { bucket: Bucket } = $props();

	const view = $derived(bucketStatusView(bucket));
	const failure = $derived(separateFailure(bucket));
	const steps = $derived(bucket.status === 'provisioning' ? provisioningSteps(bucket) : []);
	const meter = $derived(bucketUsageMeter(bucket));
	const full = $derived(isOnNode(bucket) && isBucketFull(bucket));
	const pendingQuota = $derived(pendingQuotaText(bucket));
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="bucket-overview-title"
	data-testid="bucket-overview"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<h2 id="bucket-overview-title" class="font-mono text-xl wrap-anywhere text-foreground">
				{bucket.name}
			</h2>
			<p class="flex flex-wrap gap-x-1.5 text-sm text-muted">
				<span>S3, privat</span>
				<span aria-hidden="true">·</span>
				{#if bucket.region}
					<span>region <span class="font-mono text-foreground">{bucket.region}</span></span>
				{:else}
					<span>region dipilih otomatis</span>
				{/if}
				{#if bucket.created_at}
					<span aria-hidden="true">·</span>
					<span>dibuat {formatDate(bucket.created_at)}</span>
				{/if}
			</p>
		</div>
		<BucketStatusBadge {bucket} />
	</div>

	<!-- Polite, so the change from Menyiapkan to Siap is heard without moving focus. -->
	<div
		class={cn(
			'flex flex-col gap-3 rounded-control border px-4 py-3',
			bucket.status === 'locked' || bucket.status === 'failed'
				? 'border-warning/30 bg-warning/10'
				: 'border-border bg-background-soft'
		)}
		aria-live="polite"
		data-testid="bucket-status-explanation"
	>
		<p class="text-sm text-foreground">{view.description}</p>
		{#if steps.length > 0}
			<ol
				class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6"
				aria-label="Tahap pembuatan"
			>
				{#each steps as step (step.label)}
					<li class="flex items-center gap-2 text-sm">
						<span
							class={cn(
								'flex size-5 shrink-0 items-center justify-center rounded-full',
								step.state === 'done' && 'bg-primary text-white',
								step.state === 'current' && 'text-primary-dark',
								step.state === 'pending' && 'border-2 border-border-strong'
							)}
							aria-hidden="true"
						>
							{#if step.state === 'done'}
								<Check size={12} weight="bold" />
							{:else if step.state === 'current'}
								<CircleNotch size={18} class="animate-spin motion-reduce:animate-none" />
							{/if}
						</span>
						<span class={step.state === 'pending' ? 'text-muted' : 'text-foreground'}>
							{step.label}
							<span class="sr-only"
								>{step.state === 'done'
									? '(selesai)'
									: step.state === 'current'
										? '(sedang berjalan)'
										: '(belum)'}</span
							>
						</span>
					</li>
				{/each}
			</ol>
			{#if bucket.created_at}
				<p class="text-xs text-muted">
					Diminta {formatRelativeTime(bucket.created_at).toLowerCase()}.
				</p>
			{/if}
		{/if}
	</div>

	{#if full}
		<p
			class="flex items-start gap-2 rounded-control border border-error/30 bg-error/10 px-4 py-3 text-sm text-foreground"
			data-testid="bucket-full"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-error-dark" aria-hidden="true" />
			<span><span class="font-medium">{FULL_COPY.label}.</span> {FULL_COPY.description}</span>
		</p>
	{:else if meter.level === 'warning' && isOnNode(bucket)}
		<p class="text-sm text-foreground" data-testid="bucket-nearly-full">{FULL_COPY.nearlyFull}</p>
	{/if}

	{#if failure}
		<p
			class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
			data-testid="bucket-last-failure"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
			<span>
				<span class="font-medium">Permintaan terakhir gagal.</span>
				{failure.summary}
			</span>
		</p>
	{/if}

	<dl class="grid gap-4 sm:grid-cols-3">
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Pemakaian</dt>
			<dd>
				{#if bucket.size_bytes !== null}
					<StorageBar {meter} label={`Isi ${bucket.name} terhadap kuotanya`} />
				{:else}
					<span class="text-sm text-foreground">{BUCKET_COPY.notMeasured}</span>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Kuota</dt>
			<dd class="text-sm text-foreground tabular-nums" data-testid="bucket-quota-value">
				{formatMegabytes(bucket.quota_mb)}
				{#if bucket.pending_quota_mb !== null}
					<span class="text-muted">
						→ {formatMegabytes(bucket.pending_quota_mb)}<span class="sr-only"
							>, sedang diterapkan</span
						>
					</span>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Terakhir diukur</dt>
			<dd class="text-sm text-foreground">
				{bucket.usage_checked_at
					? formatRelativeTime(bucket.usage_checked_at)
					: 'Belum dilaporkan server penyimpanan'}
			</dd>
		</div>
	</dl>
	{#if pendingQuota}
		<p class="flex items-start gap-2 text-sm text-foreground" data-testid="bucket-pending-quota">
			<CircleNotch
				size={16}
				class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
				aria-hidden="true"
			/>
			{pendingQuota}
		</p>
	{/if}
</section>
