<script lang="ts">
	// Store links carry the workspace in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import type { Valkey } from '$lib/api/resources/valkeys';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatRelativeTime } from '$lib/utils/date';
	import {
		VALKEY_COPY,
		formatMegabytes,
		isTransitional,
		regionText,
		valkeyMemoryMeter,
		valkeyRowNote
	} from '../presentation';
	import { valkeyHref } from '../routes';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';
	import ValkeyStatusBadge from './ValkeyStatusBadge.svelte';

	type Props = {
		valkeys: Valkey[];
		workspaceId: string;
		/** A project the user came to attach; the store page opens the attach dialog for it. */
		projectId?: string;
	};

	let { valkeys, workspaceId, projectId }: Props = $props();
</script>

<ul class="flex flex-col gap-3" aria-label="Daftar Valkey" data-testid="valkey-list">
	{#each valkeys as valkey (valkey.id)}
		{@const note = valkeyRowNote(valkey)}
		<li
			class="surface-card relative grid min-w-0 gap-4 p-4 transition-colors focus-within:border-primary hover:border-primary sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)] lg:items-center"
			data-testid="valkey-row"
		>
			<div class="flex min-w-0 flex-col gap-1.5">
				<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<a
						href={valkeyHref(workspaceId, valkey.id, { projectId })}
						class="min-w-0 font-mono text-base font-semibold wrap-anywhere text-foreground after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
					>
						{valkey.name}
					</a>
					<ValkeyStatusBadge {valkey} />
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<ValkeyModeLabel mode={valkey.mode} />
					<span class="text-xs text-muted tabular-nums">{formatMegabytes(valkey.maxmemory_mb)}</span
					>
				</div>
				{#if note}
					<p class="flex min-w-0 items-start gap-1.5 text-xs text-foreground">
						{#if isTransitional(valkey)}
							<CircleNotch
								size={12}
								class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
								aria-hidden="true"
							/>
						{/if}
						<span>
							{note}{#if valkey.status === 'provisioning' && valkey.created_at}, dimulai {formatRelativeTime(
									valkey.created_at
								).toLowerCase()}{/if}
						</span>
					</p>
				{/if}
			</div>

			<dl class="grid grid-cols-2 gap-x-4 gap-y-3 lg:contents">
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Memori terpakai</dt>
					<dd class="min-w-0">
						{#if valkey.usage.used_memory_bytes !== null}
							<StorageBar
								meter={valkeyMemoryMeter(valkey)}
								label={`Memori ${valkey.name} yang terpakai`}
							/>
						{:else}
							<span class="text-sm text-foreground">{VALKEY_COPY.notMeasured}</span>
						{/if}
					</dd>
				</div>
				<div class="order-last col-span-2 flex min-w-0 flex-col gap-1 lg:order-none lg:col-span-1">
					<dt class="text-xs text-muted">Proyek</dt>
					<dd class="min-w-0 text-sm wrap-anywhere text-foreground">
						{#if valkey.projects.length === 0}
							<span class="text-muted">{VALKEY_COPY.noProjects}</span>
						{:else}
							{valkey.projects.map((project) => project.name).join(', ')}
						{/if}
					</dd>
				</div>
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Region</dt>
					<dd class={cn('text-sm wrap-anywhere text-foreground', valkey.region && 'font-mono')}>
						{regionText(valkey.region)}
					</dd>
				</div>
			</dl>
		</li>
	{/each}
</ul>
