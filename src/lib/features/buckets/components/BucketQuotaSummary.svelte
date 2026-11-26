<script lang="ts">
	import Archive from 'phosphor-svelte/lib/Archive';
	import Badge from '$lib/components/ui/Badge.svelte';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import type { BucketQuota } from '../presentation';

	type Props = {
		quota: BucketQuota;
		workspaceName: string;
		/** Admins are not held to the count; the API decides for them. */
		showBlockedReason?: boolean;
		/** A count badge and the allocation meter for a list's toolbar, without the card. */
		compact?: boolean;
	};

	let { quota, workspaceName, showBlockedReason = true, compact = false }: Props = $props();
</script>

{#snippet blocked()}
	{#if showBlockedReason && quota.blockedReason}
		<p class="text-sm text-foreground" role="status" data-testid="bucket-quota-blocked">
			{quota.blockedReason}
		</p>
	{/if}
{/snippet}

{#if compact}
	<!-- The list's toolbar: the quota as a badge and a meter; a sentence only once it blocks. -->
	<div class="flex min-w-0 flex-col gap-2" data-testid="bucket-quota">
		<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
			<Badge tone={quota.count.full ? 'warning' : 'neutral'}>
				<span data-testid="bucket-quota-count">{quota.count.label}</span>{#if quota.count.full}<span
						>, penuh</span
					>{/if}
			</Badge>
			<div
				class="flex w-full max-w-64 min-w-40 flex-1 flex-col gap-0.5"
				data-testid="bucket-quota-storage"
			>
				<StorageBar meter={quota.allocation} label="Jatah penyimpanan bucket yang dialokasikan" />
				<span class="text-xs text-muted tabular-nums">{quota.usedLabel}</span>
			</div>
		</div>
		{@render blocked()}
	</div>
{:else}
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

		{@render blocked()}
	</section>
{/if}
