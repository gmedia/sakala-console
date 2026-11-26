<script lang="ts">
	import Database from 'phosphor-svelte/lib/Database';
	import type { DatabaseQuota } from '../presentation';
	import { QUOTA_COPY } from '../presentation';
	import Badge from '$lib/components/ui/Badge.svelte';
	import StorageBar from './StorageBar.svelte';

	type Props = {
		quota: DatabaseQuota;
		workspaceName: string;
		/** Admins are not held to the count; the API decides for them. */
		showBlockedReason?: boolean;
		/** A count badge and a storage meter for a list's toolbar, without the card. */
		compact?: boolean;
	};

	let { quota, workspaceName, showBlockedReason = true, compact = false }: Props = $props();

	const storageNote = $derived(
		quota.storage.level === 'warning' ? QUOTA_COPY.storageWarning : null
	);
</script>

{#snippet notice()}
	{#if showBlockedReason && quota.blockedReason}
		<p class="text-sm text-foreground" role="status" data-testid="database-quota-blocked">
			{quota.blockedReason}
		</p>
	{:else if storageNote}
		<p class="text-sm text-foreground" role="status">{storageNote}</p>
	{/if}
{/snippet}

{#if compact}
	<!-- The list's toolbar: the quota as a badge and a meter; a sentence only once it blocks. -->
	<div class="flex min-w-0 flex-col gap-2" data-testid="database-quota">
		<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
			<Badge tone={quota.count.full ? 'warning' : 'neutral'}>
				<span data-testid="database-quota-count">{quota.count.label}</span
				>{#if quota.count.full}<span>, penuh</span>{/if}
			</Badge>
			<div class="w-full max-w-56 min-w-40 flex-1" data-testid="database-quota-storage">
				<StorageBar meter={quota.storage} label="Penyimpanan database workspace" />
			</div>
		</div>
		{@render notice()}
	</div>
{:else}
	<section
		class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
		aria-labelledby="database-quota-heading"
		data-testid="database-quota"
	>
		<div class="flex min-w-0 items-start gap-3">
			<span
				class="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-dark"
			>
				<Database size={20} aria-hidden="true" />
			</span>
			<div class="flex min-w-0 flex-col gap-0.5">
				<h2 id="database-quota-heading" class="text-base text-foreground">
					Kuota database <span class="wrap-anywhere">{workspaceName}</span>
				</h2>
				<p class="text-sm text-muted">Dipakai bersama semua anggota workspace.</p>
			</div>
		</div>

		<dl class="grid gap-3 sm:grid-cols-2">
			<div class="flex min-w-0 flex-col gap-1">
				<dt class="text-xs text-muted">Jumlah</dt>
				<dd
					class="text-sm font-semibold text-foreground tabular-nums"
					data-testid="database-quota-count"
				>
					{quota.count.label}
					{#if quota.count.full}
						<span class="ml-1 text-xs font-medium text-warning-dark">penuh</span>
					{/if}
				</dd>
			</div>
			<div class="flex min-w-0 flex-col gap-1">
				<dt class="text-xs text-muted">Penyimpanan</dt>
				<dd data-testid="database-quota-storage">
					<StorageBar meter={quota.storage} label="Penyimpanan database workspace" />
				</dd>
			</div>
		</dl>

		{@render notice()}
	</section>
{/if}
