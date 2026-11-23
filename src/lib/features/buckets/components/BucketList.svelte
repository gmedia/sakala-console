<script lang="ts">
	// Bucket links carry the workspace in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import type { Bucket } from '$lib/api/resources/buckets';
	import StorageBar from '$lib/features/databases/components/StorageBar.svelte';
	import { cn } from '$lib/utils/cn';
	import { formatRelativeTime } from '$lib/utils/date';
	import {
		BUCKET_COPY,
		bucketRowNote,
		bucketUsageMeter,
		formatMegabytes,
		isTransitional,
		regionText
	} from '../presentation';
	import { bucketHref } from '../routes';
	import BucketStatusBadge from './BucketStatusBadge.svelte';

	type Props = {
		buckets: Bucket[];
		workspaceId: string;
		/** A project the user came to attach; the bucket page opens the attach dialog for it. */
		projectId?: string;
	};

	let { buckets, workspaceId, projectId }: Props = $props();
</script>

<ul class="flex flex-col gap-3" aria-label="Daftar bucket" data-testid="bucket-list">
	{#each buckets as bucket (bucket.id)}
		{@const note = bucketRowNote(bucket)}
		<li
			class="surface-card relative grid min-w-0 gap-4 p-4 transition-colors focus-within:border-primary hover:border-primary sm:p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.5fr)] lg:items-center"
			data-testid="bucket-row"
		>
			<div class="flex min-w-0 flex-col gap-1.5">
				<div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<a
						href={bucketHref(workspaceId, bucket.id, { projectId })}
						class="min-w-0 font-mono text-base font-semibold wrap-anywhere text-foreground after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-primary"
					>
						{bucket.name}
					</a>
					<BucketStatusBadge {bucket} />
				</div>
				<p class="text-xs text-muted">S3, privat</p>
				{#if note}
					<p class="flex min-w-0 items-start gap-1.5 text-xs text-foreground">
						{#if isTransitional(bucket)}
							<CircleNotch
								size={12}
								class="mt-0.5 shrink-0 animate-spin text-primary-dark motion-reduce:animate-none"
								aria-hidden="true"
							/>
						{/if}
						<span>
							{note}{#if bucket.status === 'provisioning' && bucket.created_at}, dimulai {formatRelativeTime(
									bucket.created_at
								).toLowerCase()}{/if}
						</span>
					</p>
				{/if}
			</div>

			<dl class="grid grid-cols-2 gap-x-4 gap-y-3 lg:contents">
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Pemakaian</dt>
					<dd class="min-w-0">
						{#if bucket.size_bytes !== null}
							<StorageBar
								meter={bucketUsageMeter(bucket)}
								label={`Isi ${bucket.name} terhadap kuotanya`}
							/>
						{:else}
							<span class="text-sm text-foreground tabular-nums"
								>{BUCKET_COPY.notMeasured}, kuota {formatMegabytes(bucket.quota_mb)}</span
							>
						{/if}
					</dd>
				</div>
				<div class="order-last col-span-2 flex min-w-0 flex-col gap-1 lg:order-none lg:col-span-1">
					<dt class="text-xs text-muted">Proyek</dt>
					<dd class="min-w-0 text-sm wrap-anywhere text-foreground">
						{#if bucket.projects.length === 0}
							<span class="text-muted">{BUCKET_COPY.noProjects}</span>
						{:else}
							{bucket.projects.map((project) => project.name).join(', ')}
						{/if}
					</dd>
				</div>
				<div class="flex min-w-0 flex-col gap-1">
					<dt class="text-xs text-muted">Region</dt>
					<dd class={cn('text-sm wrap-anywhere text-foreground', bucket.region && 'font-mono')}>
						{regionText(bucket.region)}
					</dd>
				</div>
			</dl>
		</li>
	{/each}
</ul>
