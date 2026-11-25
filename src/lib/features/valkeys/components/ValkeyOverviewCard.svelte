<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { VALKEY_MODE, AOF_WRITE_FAILED, type Valkey } from '$lib/api/resources/valkeys';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import {
		LOCKED_COPY,
		VALKEY_COPY,
		formatMegabytes,
		pendingResizeText,
		provisioningSteps,
		separateFailure,
		valkeyMemoryMeter,
		valkeyMemoryNotice,
		valkeyModeView,
		valkeyStatusView
	} from '../presentation';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';
	import ValkeyStatusBadge from './ValkeyStatusBadge.svelte';

	let { valkey }: { valkey: Valkey } = $props();

	const countFormat = new Intl.NumberFormat('id-ID');
	/** A reading the node has not sent yet, or one that does not apply to this mode. */
	const NOT_REPORTED = 'Belum dilaporkan';

	const view = $derived(valkeyStatusView(valkey));
	const mode = $derived(valkeyModeView(valkey.mode));
	const failure = $derived(separateFailure(valkey));
	const steps = $derived(valkey.status === 'provisioning' ? provisioningSteps(valkey) : []);
	const meter = $derived(valkeyMemoryMeter(valkey));
	const memoryNotice = $derived(valkeyMemoryNotice(valkey));
	const pendingResize = $derived(pendingResizeText(valkey));
	const usage = $derived(valkey.usage);
	// The node could not write the append-only file: data since the last good write may be lost.
	const aofFailing = $derived(
		valkey.mode === VALKEY_MODE.persistent && usage.aof_last_write_status === AOF_WRITE_FAILED
	);
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="valkey-overview-title"
	data-testid="valkey-overview"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1.5">
			<h2 id="valkey-overview-title" class="font-mono text-xl wrap-anywhere text-foreground">
				{valkey.name}
			</h2>
			<p class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
				<ValkeyModeLabel mode={valkey.mode} />
				<span aria-hidden="true">·</span>
				{#if valkey.region}
					<span>region <span class="font-mono text-foreground">{valkey.region}</span></span>
				{:else}
					<span>region dipilih otomatis</span>
				{/if}
				{#if valkey.created_at}
					<span aria-hidden="true">·</span>
					<span>dibuat {formatDate(valkey.created_at)}</span>
				{/if}
			</p>
		</div>
		<ValkeyStatusBadge {valkey} />
	</div>

	<!-- Polite, so the change from Menyiapkan to Siap is heard without moving focus. -->
	<div
		class={cn(
			'flex flex-col gap-3 rounded-control border px-4 py-3',
			valkey.status === 'locked' || valkey.status === 'failed'
				? 'border-warning/30 bg-warning/10'
				: 'border-border bg-background-soft'
		)}
		aria-live="polite"
		data-testid="valkey-status-explanation"
	>
		<p class="text-sm text-foreground">{view.description}</p>
		{#if valkey.status === 'locked'}
			<p class="text-sm text-foreground" data-testid="valkey-locked-why">{LOCKED_COPY.why}</p>
		{/if}
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
			{#if valkey.created_at}
				<p class="text-xs text-muted">
					Diminta {formatRelativeTime(valkey.created_at).toLowerCase()}.
				</p>
			{/if}
		{/if}
	</div>

	<p class="text-sm text-foreground" data-testid="valkey-mode-explanation">
		<span class="font-medium">Mode {mode.label.toLowerCase()}.</span>
		{mode.summary}
		{mode.whenFull}
	</p>

	{#if memoryNotice}
		<p
			class={cn(
				'flex items-start gap-2 rounded-control border px-4 py-3 text-sm text-foreground',
				memoryNotice.level === 'full'
					? 'border-error/30 bg-error/10'
					: 'border-warning/30 bg-warning/10'
			)}
			data-testid="valkey-memory-notice"
		>
			<Warning
				size={18}
				class={cn(
					'mt-0.5 shrink-0',
					memoryNotice.level === 'full' ? 'text-error-dark' : 'text-warning-dark'
				)}
				aria-hidden="true"
			/>
			<span>{memoryNotice.text}</span>
		</p>
	{/if}

	{#if aofFailing}
		<p
			class="flex items-start gap-2 rounded-control border border-error/30 bg-error/10 px-4 py-3 text-sm text-foreground"
			data-testid="valkey-aof-error"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-error-dark" aria-hidden="true" />
			<span>
				Valkey gagal menulis data ke disk pada pembacaan terakhir. Data baru mungkin belum tersimpan
				permanen. Kalau ini tidak hilang dalam beberapa menit, hubungi operator Sakala.
			</span>
		</p>
	{/if}

	{#if failure}
		<p
			class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
			data-testid="valkey-last-failure"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
			<span>
				<span class="font-medium">Permintaan terakhir gagal.</span>
				{failure.summary}
			</span>
		</p>
	{/if}

	<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="flex min-w-0 flex-col gap-1 sm:col-span-2">
			<dt class="text-xs text-muted">Memori terpakai</dt>
			<dd>
				{#if usage.used_memory_bytes !== null}
					<StorageBar {meter} label={`Memori ${valkey.name} yang terpakai`} />
				{:else}
					<span class="text-sm text-foreground">{VALKEY_COPY.notMeasured}</span>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Ukuran</dt>
			<dd class="text-sm text-foreground tabular-nums" data-testid="valkey-size-value">
				{formatMegabytes(valkey.maxmemory_mb)}
				{#if valkey.pending_maxmemory_mb !== null}
					<span class="text-muted">
						menjadi {formatMegabytes(valkey.pending_maxmemory_mb)}<span class="sr-only"
							>, sedang diterapkan</span
						>
					</span>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Koneksi terbuka</dt>
			<dd class="text-sm text-foreground tabular-nums">
				{usage.connected_clients === null
					? NOT_REPORTED
					: countFormat.format(usage.connected_clients)}
			</dd>
		</div>
		{#if valkey.mode === VALKEY_MODE.cache}
			<div class="flex min-w-0 flex-col gap-1">
				<dt class="text-xs text-muted">Key dibuang karena penuh</dt>
				<dd class="text-sm text-foreground tabular-nums" data-testid="valkey-evicted">
					{#if usage.evicted_keys === null}
						{NOT_REPORTED}
					{:else}
						{countFormat.format(usage.evicted_keys)} <span class="text-muted">sejak start</span>
					{/if}
				</dd>
			</div>
		{:else}
			<div class="flex min-w-0 flex-col gap-1">
				<dt class="text-xs text-muted">Tulisan ditolak karena penuh</dt>
				<dd class="text-sm text-foreground tabular-nums" data-testid="valkey-oom">
					{#if usage.errorstat_oom === null}
						{NOT_REPORTED}
					{:else}
						{countFormat.format(usage.errorstat_oom)} <span class="text-muted">sejak start</span>
					{/if}
				</dd>
			</div>
		{/if}
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Terakhir diukur</dt>
			<dd class="text-sm text-foreground">
				{usage.checked_at ? formatRelativeTime(usage.checked_at) : NOT_REPORTED}
			</dd>
		</div>
	</dl>
	{#if pendingResize}
		<p class="flex items-start gap-2 text-sm text-foreground" data-testid="valkey-pending-resize">
			<CircleNotch
				size={16}
				class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
				aria-hidden="true"
			/>
			{pendingResize}
		</p>
	{/if}
</section>
