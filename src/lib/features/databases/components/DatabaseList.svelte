<script lang="ts">
	// Database links carry the workspace in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import type { Database } from '$lib/api/resources/databases';
	import { formatRelativeTime } from '$lib/utils/date';
	import {
		databaseRowNote,
		engineLabel,
		formatDatabaseSize,
		isTransitional,
		regionText,
		storageMeter,
		DATABASE_COPY
	} from '../presentation';
	import { databaseHref } from '../routes';
	import DatabaseStatusBadge from './DatabaseStatusBadge.svelte';
	import StorageBar from './StorageBar.svelte';

	type Props = {
		databases: Database[];
		workspaceId: string;
		/** The workspace's storage quota in MB, when the API reports it. */
		storageQuotaMb?: number;
		/** A project the user came to attach; the database page opens the attach dialog for it. */
		projectId?: string;
	};

	let { databases, workspaceId, storageQuotaMb, projectId }: Props = $props();
</script>

<ul class="flex flex-col gap-3" aria-label="Daftar database" data-testid="database-list">
	{#each databases as database (database.id)}
		{@const note = databaseRowNote(database)}
		<li
			class="surface-card relative grid min-w-0 gap-4 p-4 transition-colors focus-within:border-primary hover:border-primary sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)] lg:items-center"
			data-testid="database-row"
		>
			<div class="flex min-w-0 flex-col gap-1.5">
				<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<a
						href={databaseHref(workspaceId, database.id, { projectId })}
						class="min-w-0 font-mono text-base font-semibold wrap-anywhere text-foreground after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
					>
						{database.name}
					</a>
					<DatabaseStatusBadge {database} />
				</div>
				<p class="text-xs text-muted">{engineLabel(database.engine)}</p>
				{#if note}
					<p class="flex min-w-0 items-start gap-1.5 text-xs text-foreground">
						{#if isTransitional(database)}
							<CircleNotch
								size={12}
								class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
								aria-hidden="true"
							/>
						{/if}
						<span>
							{note}{#if database.status === 'provisioning' && database.created_at}, dimulai {formatRelativeTime(
									database.created_at
								).toLowerCase()}{/if}
						</span>
					</p>
				{/if}
			</div>

			<dl class="grid grid-cols-2 gap-x-4 gap-y-3 lg:contents">
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Ukuran</dt>
					<dd class="min-w-0">
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
				<div class="order-last col-span-2 flex min-w-0 flex-col gap-1 lg:order-none lg:col-span-1">
					<dt class="text-xs text-muted">Proyek</dt>
					<dd class="min-w-0 text-sm wrap-anywhere text-foreground">
						{#if database.projects.length === 0}
							<span class="text-muted">{DATABASE_COPY.noProjects}</span>
						{:else}
							{database.projects.map((project) => project.name).join(', ')}
						{/if}
					</dd>
				</div>
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Region</dt>
					<dd class="font-mono text-sm wrap-anywhere text-foreground">
						{regionText(database.region)}
					</dd>
				</div>
			</dl>
		</li>
	{/each}
</ul>
