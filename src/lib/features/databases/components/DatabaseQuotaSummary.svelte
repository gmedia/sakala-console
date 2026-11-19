<script lang="ts">
	import Database from 'phosphor-svelte/lib/Database';
	import type { DatabaseQuota } from '../presentation';
	import { QUOTA_COPY } from '../presentation';
	import StorageBar from './StorageBar.svelte';

	type Props = {
		quota: DatabaseQuota;
		workspaceName: string;
		/** Admins are not held to the count; the API decides for them. */
		showBlockedReason?: boolean;
	};

	let { quota, workspaceName, showBlockedReason = true }: Props = $props();

	const storageNote = $derived(
		quota.storage.level === 'warning' ? QUOTA_COPY.storageWarning : null
	);
</script>

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

	{#if showBlockedReason && quota.blockedReason}
		<p class="text-sm text-foreground" role="status" data-testid="database-quota-blocked">
			{quota.blockedReason}
		</p>
	{:else if storageNote}
		<p class="text-sm text-foreground" role="status">{storageNote}</p>
	{/if}
</section>
