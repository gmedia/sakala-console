<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Warning from 'phosphor-svelte/lib/Warning';
	import type { Database } from '$lib/api/resources/databases';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import { cn } from '$lib/utils/cn';
	import {
		databaseStatusView,
		engineLabel,
		formatDatabaseSize,
		provisioningSteps,
		separateFailure,
		storageMeter
	} from '../presentation';
	import { DATABASE_PANEL_COPY as FACTS } from '../panel';
	import DatabaseStatusBadge from './DatabaseStatusBadge.svelte';
	import StorageBar from './StorageBar.svelte';

	type Props = {
		database: Database;
		/** The workspace's storage quota in MB, when the API reports it. */
		storageQuotaMb?: number;
		/** The workspace's total, which the lock compares against the quota. */
		workspaceStorage?: { label: string } | null;
	};

	let { database, storageQuotaMb, workspaceStorage = null }: Props = $props();

	const countFormat = new Intl.NumberFormat('id-ID');

	const view = $derived(databaseStatusView(database));
	const failure = $derived(separateFailure(database));
	const steps = $derived(database.status === 'provisioning' ? provisioningSteps(database) : []);
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="database-overview-title"
	data-testid="database-overview"
>
	<!-- The database's facts in one line of badges and values, like a project's header. -->
	<div class="flex min-w-0 flex-col gap-2">
		<h2 id="database-overview-title" class="font-mono text-xl wrap-anywhere text-foreground">
			{database.name}
		</h2>
		<p
			class="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted"
			data-testid="database-facts"
		>
			<DatabaseStatusBadge {database} />
			<span class="text-foreground">{engineLabel(database.engine)}</span>
			<span aria-hidden="true">·</span>
			{#if database.region}
				<span class="font-mono text-foreground">{database.region}</span>
			{:else}
				<span data-testid="database-region-auto">{FACTS.autoRegion}</span>
			{/if}
			<span aria-hidden="true">·</span>
			<span data-testid="database-facts-projects"
				>{FACTS.projects(countFormat.format(database.projects.length))}</span
			>
			{#if database.created_at}
				<span aria-hidden="true">·</span>
				<span>{FACTS.created(formatDate(database.created_at))}</span>
			{/if}
		</p>
	</div>

	<!-- Polite, so the change from Menyiapkan to Siap is heard without moving focus. -->
	<div
		class={cn(
			'flex flex-col gap-3 rounded-control border px-4 py-3',
			database.status === 'locked' || database.status === 'failed'
				? 'border-warning/30 bg-warning/10'
				: 'border-border bg-background-soft'
		)}
		aria-live="polite"
		data-testid="database-status-explanation"
	>
		<p class="text-sm text-foreground">{view.description}</p>
		{#if workspaceStorage && database.status === 'locked'}
			<p class="text-sm text-foreground">
				Pemakaian workspace sekarang: <span class="font-medium tabular-nums"
					>{workspaceStorage.label}</span
				>.
			</p>
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
			{#if database.created_at}
				<p class="text-xs text-muted">
					Diminta {formatRelativeTime(database.created_at).toLowerCase()}.
				</p>
			{/if}
		{/if}
	</div>

	{#if failure}
		<p
			class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
			data-testid="database-last-failure"
		>
			<Warning size={18} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
			<span>
				<span class="font-medium">Permintaan terakhir gagal.</span>
				{failure.summary}
			</span>
		</p>
	{/if}

	<dl class="grid gap-4 sm:grid-cols-2">
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Ukuran</dt>
			<dd>
				{#if storageQuotaMb !== undefined && database.size_bytes !== null}
					<StorageBar
						meter={storageMeter(database.size_bytes, storageQuotaMb)}
						label={`Ukuran ${database.name} terhadap kuota workspace`}
					/>
				{:else}
					<span class="text-sm text-foreground tabular-nums"
						>{formatDatabaseSize(database.size_bytes)}</span
					>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Terakhir diukur</dt>
			<dd class="text-sm text-foreground">
				{database.size_checked_at
					? formatRelativeTime(database.size_checked_at)
					: 'Belum dilaporkan server database'}
			</dd>
		</div>
	</dl>
</section>
