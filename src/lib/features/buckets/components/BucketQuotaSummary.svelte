<script lang="ts">
	import Archive from 'phosphor-svelte/lib/Archive';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import type { BucketQuota } from '../presentation';

	type Props = {
		quota: BucketQuota;
		workspaceName: string;
		/** Admins are not held to the count; the API decides for them. */
		showBlockedReason?: boolean;
	};

	let { quota, workspaceName, showBlockedReason = true }: Props = $props();
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="bucket-quota-heading"
	data-testid="bucket-quota"
>
	<div class="flex min-w-0 items-start gap-3">
		<span
			class="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-50 text-primary-dark"
		>
			<Archive size={20} aria-hidden="true" />
		</span>
		<div class="flex min-w-0 flex-col gap-0.5">
			<h2 id="bucket-quota-heading" class="text-base text-foreground">
				Kuota bucket <span class="wrap-anywhere">{workspaceName}</span>
			</h2>
			<p class="text-sm text-muted">
				Dipakai bersama semua anggota workspace. Setiap bucket mengambil kuotanya dari jatah ini.
			</p>
		</div>
	</div>

	<dl class="grid gap-3 sm:grid-cols-2">
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Jumlah</dt>
			<dd
				class="text-sm font-semibold text-foreground tabular-nums"
				data-testid="bucket-quota-count"
			>
				{quota.count.label}
				{#if quota.count.full}
					<span class="ml-1 text-xs font-medium text-warning-dark">penuh</span>
				{/if}
			</dd>
		</div>
		<div class="flex min-w-0 flex-col gap-1">
			<dt class="text-xs text-muted">Penyimpanan</dt>
			<dd class="flex flex-col gap-1" data-testid="bucket-quota-storage">
				<StorageBar meter={quota.allocation} label="Jatah penyimpanan bucket yang dialokasikan" />
				<span class="text-xs text-muted tabular-nums">{quota.usedLabel}</span>
			</dd>
		</div>
	</dl>

	{#if showBlockedReason && quota.blockedReason}
		<p class="text-sm text-foreground" role="status" data-testid="bucket-quota-blocked">
			{quota.blockedReason}
		</p>
	{/if}
</section>
