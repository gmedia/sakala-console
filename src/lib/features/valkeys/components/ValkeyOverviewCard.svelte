<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { tick } from 'svelte';
	import { VALKEY_MODE, AOF_WRITE_FAILED, type Valkey } from '$lib/api/resources/valkeys';
	import InlineEditButton from '$lib/components/ui/InlineEditButton.svelte';
	import InlineRenameForm from '$lib/components/ui/InlineRenameForm.svelte';
	import { openAtAnchor } from '$lib/components/ui/inline-edit.svelte';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import { createUpdateValkeyMutation } from '../mutations';
	import { VALKEY_ANCHORS, VALKEY_PANEL_COPY as FACTS } from '../panel';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';
	import ValkeyResizeForm from './ValkeyResizeForm.svelte';
	import ValkeyStatusBadge from './ValkeyStatusBadge.svelte';
	import {
		LOCKED_COPY,
		VALKEY_COPY,
		VALKEY_NAME_MAX_LENGTH,
		formatMegabytes,
		pendingResizeText,
		provisioningSteps,
		separateFailure,
		valkeyMemoryMeter,
		valkeyErrorMessage,
		valkeyMemoryNotice,
		valkeyStatusView
	} from '../presentation';

	type Props = {
		valkey: Valkey;
		workspaceId: string;
		/** Owners and members rename and resize; viewers see the values only. */
		canManage: boolean;
		sizes: number[];
		/** MB the workspace may still reserve besides this store; `null` when the API decides. */
		availableMb: number | null;
	};

	let { valkey, workspaceId, canManage, sizes, availableMb }: Props = $props();

	const EDITOR_IDS = { name: 'valkey-rename', size: 'valkey-resize-editor' } as const;
	const renameMutation = createUpdateValkeyMutation();

	// Renaming and resizing are rare, one field each: they open in place, next to their value.
	let editing = $state<'name' | 'size' | null>(null);
	let nameTrigger = $state<HTMLElement | null>(null);
	let sizeTrigger = $state<HTMLElement | null>(null);

	async function close() {
		const trigger = editing === 'name' ? nameTrigger : sizeTrigger;
		editing = null;
		await tick();
		trigger?.focus();
	}

	function toggle(part: 'name' | 'size') {
		if (editing === part) void close();
		else editing = part;
	}

	// The panel's "Perbesar ukuran" links here.
	openAtAnchor(
		VALKEY_ANCHORS.resize,
		EDITOR_IDS.size,
		() => canManage,
		() => (editing = 'size')
	);

	const countFormat = new Intl.NumberFormat('id-ID');
	/** A reading the node has not sent yet, or one that does not apply to this mode. */
	const NOT_REPORTED = 'Belum dilaporkan';

	const view = $derived(valkeyStatusView(valkey));
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
	<!-- The store's facts in one line of badges and values, like a project's header. -->
	<div class="flex min-w-0 flex-col gap-2">
		<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
			<h2
				id="valkey-overview-title"
				class="min-w-0 font-mono text-xl wrap-anywhere text-foreground"
			>
				{valkey.name}
			</h2>
			{#if canManage}
				<InlineEditButton
					subject="nama Valkey"
					expanded={editing === 'name'}
					controls={EDITOR_IDS.name}
					onclick={() => toggle('name')}
					bind:ref={nameTrigger}
					testid="edit-valkey-name"
				/>
			{/if}
		</div>
		{#if editing === 'name'}
			<InlineRenameForm
				id={EDITOR_IDS.name}
				label="Nama Valkey"
				hint="Hanya nama tampilan. Koneksi dan variabel proyek tidak berubah."
				value={valkey.name}
				maxLength={VALKEY_NAME_MAX_LENGTH}
				noun="Valkey"
				save={(name) =>
					renameMutation.mutateAsync({ workspaceId, valkeyId: valkey.id, payload: { name } })}
				errorMessage={(error) =>
					valkeyErrorMessage(
						error,
						'rename',
						'Nama Valkey belum diganti. Muat ulang halaman, lalu simpan lagi.'
					)}
				onClose={close}
				testid="valkey-rename"
			/>
		{/if}
		<p
			class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted"
			data-testid="valkey-facts"
		>
			<ValkeyStatusBadge {valkey} />
			<ValkeyModeLabel mode={valkey.mode} />
			<!-- The value and its Ubah wrap together, so the action never lands on a line of its own. -->
			<span class="inline-flex items-center gap-1">
				<span
					id={VALKEY_ANCHORS.resize}
					class="scroll-mt-4 text-foreground tabular-nums"
					data-testid="valkey-size-value"
				>
					{formatMegabytes(valkey.maxmemory_mb)}
					{#if valkey.pending_maxmemory_mb !== null}
						<span class="text-muted">
							menjadi {formatMegabytes(valkey.pending_maxmemory_mb)}<span class="sr-only"
								>, sedang diterapkan</span
							>
						</span>
					{/if}
				</span>
				{#if canManage}
					<InlineEditButton
						subject="ukuran Valkey"
						expanded={editing === 'size'}
						controls={EDITOR_IDS.size}
						onclick={() => toggle('size')}
						bind:ref={sizeTrigger}
						testid="edit-valkey-size"
					/>
				{/if}
			</span>
			<span aria-hidden="true">·</span>
			{#if valkey.region}
				<span class="font-mono text-foreground">{valkey.region}</span>
			{:else}
				<span>{FACTS.autoRegion}</span>
			{/if}
			<span aria-hidden="true">·</span>
			<span data-testid="valkey-facts-projects"
				>{FACTS.projects(countFormat.format(valkey.projects.length))}</span
			>
			{#if valkey.created_at}
				<span aria-hidden="true">·</span>
				<span>{FACTS.created(formatDate(valkey.created_at))}</span>
			{/if}
		</p>
		{#if editing === 'size'}
			<ValkeyResizeForm
				id={EDITOR_IDS.size}
				{valkey}
				{workspaceId}
				{sizes}
				{availableMb}
				onClose={close}
			/>
		{/if}
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

	<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
