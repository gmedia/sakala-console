<script lang="ts">
	import type { PilotLimits } from '$lib/api/resources/pilot-limits';
	import { workspaceIdleSleepSummary, workspaceLimitRows } from '../limits';

	let { limits, isLoading = false }: { limits: PilotLimits | undefined; isLoading?: boolean } =
		$props();

	const rows = $derived(limits ? workspaceLimitRows(limits) : []);
	const idleSleep = $derived(limits ? workspaceIdleSleepSummary(limits) : null);
</script>

<section class="surface-card flex flex-col gap-3 p-4 sm:p-6" aria-labelledby="limits-heading">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h3 id="limits-heading" class="text-base font-semibold text-foreground">Batas workspace</h3>
		{#if limits}
			<p class="text-sm text-muted" data-testid="limit-profile">
				{limits.limit_profile
					? `Profil batas: ${limits.limit_profile.name}`
					: 'Batas bawaan, belum ada profil dari admin'}
			</p>
		{/if}
	</div>
	{#if isLoading}
		<div class="skeleton h-12 w-full" role="status" aria-label="Memuat batas workspace"></div>
	{:else if rows.length === 0}
		<p class="text-sm text-muted">Batas workspace belum bisa dimuat.</p>
	{:else}
		<dl class="grid gap-3 sm:grid-cols-3">
			{#each rows as row (row.label)}
				<div class="rounded-control border border-border p-3">
					<dt class="text-xs text-muted">{row.label}</dt>
					<dd class="mt-1 text-base font-semibold text-foreground tabular-nums">
						{row.used} dari {row.max}
						{#if row.reached}
							<span class="ml-1 text-xs font-medium text-warning">penuh</span>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
		{#if idleSleep}
			<p class="text-sm text-foreground">{idleSleep}</p>
		{/if}
		<p class="text-xs text-muted">
			Batas berlaku untuk seluruh workspace, dipakai bersama semua anggota. Admin Sakala bisa
			memasang profil batas yang lebih besar.
		</p>
	{/if}
</section>
