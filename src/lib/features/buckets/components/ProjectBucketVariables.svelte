<script lang="ts">
	// Links come from resolveRoute() in the routes helpers, some with a query string.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import Archive from 'phosphor-svelte/lib/Archive';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Warning from 'phosphor-svelte/lib/Warning';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getErrorMessage } from '$lib/api/errors';
	import { isLaravelStack } from '$lib/features/projects/build-help';
	import { createAddEnvironmentVariableMutation } from '$lib/features/projects/mutations';
	import type { Project } from '$lib/features/projects/type';
	import { limitsWorkspaceId } from '$lib/features/workspaces/presentation';
	import { createWorkspaceLimitsQuery } from '$lib/features/workspaces/queries';
	import { BUCKET_COPY, bucketStatusView, canOfferProjectBucket } from '../presentation';
	import { bucketVariableRows, overridesBucketKey } from '../project-variables';
	import { bucketHref } from '../routes';
	import CreateProjectBucketLink from './CreateProjectBucketLink.svelte';
	import { LARAVEL_FILESYSTEM_DISK } from '../variables';

	type Props = {
		project: Pick<Project, 'id' | 'buckets' | 'workspace' | 'stack'>;
		readOnly: boolean;
		/** The project's own variable names; `undefined` while they load. */
		projectKeys: ReadonlySet<string> | undefined;
	};

	let { project, readOnly, projectKeys }: Props = $props();

	const bucket = $derived(project.buckets?.[0] ?? null);
	const rows = $derived(bucket ? bucketVariableRows(bucket) : []);
	const view = $derived(
		bucket ? bucketStatusView({ status: bucket.status, last_failure: null }) : null
	);
	const workspaceId = $derived(project.workspace?.id ?? null);
	const keyOverridden = $derived(bucket ? overridesBucketKey(bucket) : false);

	// The offer to create one only appears where it can work: a workspace opened for buckets.
	const limitsQuery = createWorkspaceLimitsQuery(
		() => limitsWorkspaceId(project.workspace),
		() => ({ enabled: !bucket && !readOnly && project.buckets !== undefined })
	);
	const offerBucket = $derived(
		!bucket && !readOnly && project.buckets !== undefined && canOfferProjectBucket(limitsQuery.data)
	);

	// Laravel keeps uploads on its local disk until FILESYSTEM_DISK says otherwise.
	const needsDiskHint = $derived(
		Boolean(bucket) &&
			isLaravelStack(project.stack) &&
			projectKeys !== undefined &&
			!projectKeys.has(LARAVEL_FILESYSTEM_DISK.key)
	);
	const addMutation = createAddEnvironmentVariableMutation();
	let diskError = $state<string | null>(null);

	async function addFilesystemDisk() {
		diskError = null;
		try {
			await addMutation.mutateAsync({
				projectId: project.id,
				data: {
					key: LARAVEL_FILESYSTEM_DISK.key,
					value: LARAVEL_FILESYSTEM_DISK.value,
					is_secret: false
				}
			});
			toast.success(
				`${LARAVEL_FILESYSTEM_DISK.key}=${LARAVEL_FILESYSTEM_DISK.value} ditambahkan. Berlaku di deploy berikutnya.`
			);
		} catch (error) {
			diskError = getErrorMessage(
				error,
				`${LARAVEL_FILESYSTEM_DISK.key} belum ditambahkan. Muat ulang halaman, lalu tambahkan lagi.`
			);
		}
	}
</script>

{#if bucket && view}
	<section
		class="mt-6 flex min-w-0 flex-col gap-3"
		aria-labelledby="bucket-variables-title"
		data-testid="bucket-variables"
	>
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
			<h2
				id="bucket-variables-title"
				class="flex min-w-0 items-center gap-2 text-base text-foreground"
			>
				<Archive size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
				<span class="min-w-0 wrap-anywhere">
					Dari bucket <span class="font-mono">{bucket.name}</span>
				</span>
				<Badge tone={view.tone}>{view.label}</Badge>
			</h2>
			{#if workspaceId}
				<a
					href={bucketHref(workspaceId, bucket.id)}
					class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
				>
					Buka bucket
				</a>
			{/if}
		</div>
		<p class="text-sm text-muted">
			Disuntik Sakala saat deploy, jadi tidak bisa diubah di sini dan nilainya tidak ditampilkan.
			Variabel proyek dengan nama yang sama menang.
		</p>
		{#if bucket.status !== 'ready'}
			<p class="text-sm text-foreground">{view.description}</p>
		{/if}

		<ul
			class="@container flex w-full flex-col divide-y divide-border rounded-control border border-border bg-surface"
		>
			{#each rows as row (row.name)}
				<li
					class="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 @2xl:grid-cols-[14.5rem_minmax(0,1fr)_auto] @2xl:px-6"
					data-testid={`bucket-variable-${row.name}`}
				>
					<span class="min-w-0 font-mono text-sm font-semibold wrap-anywhere text-foreground">
						{row.name}
					</span>
					<span
						class="col-span-2 row-start-2 min-w-0 text-sm @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1"
					>
						{#if row.overridden}
							<span class="text-foreground">
								Nilai dari variabel proyek yang dipakai, bukan dari {bucket.name}.
							</span>
						{:else}
							<span class="text-muted">dari bucket {bucket.name}, nilai disembunyikan</span>
						{/if}
					</span>
					<span class="col-start-2 row-start-1 @2xl:col-start-3">
						{#if row.overridden}
							<Badge tone="warning">Ditimpa proyek</Badge>
						{:else}
							<Badge tone="neutral">Otomatis</Badge>
						{/if}
					</span>
				</li>
			{/each}
		</ul>

		{#if keyOverridden}
			<p
				class="flex items-start gap-2 rounded-control border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
				role="status"
				data-testid="bucket-variables-key-conflict"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span>
					Proyek ini memakai access key AWS miliknya sendiri, sementara endpoint dan nama bucket
					tetap dari Sakala. Kombinasi ini biasanya ditolak server penyimpanan. Hapus variabel
					proyek yang bertanda "Menimpa bucket" di atas, kecuali aplikasimu memang memakai S3 lain.
				</span>
			</p>
		{:else if rows.some((row) => row.overridden)}
			<p
				class="flex items-start gap-2 text-sm text-foreground"
				data-testid="bucket-variables-conflict"
			>
				<Warning size={16} class="mt-0.5 shrink-0 text-warning-dark" aria-hidden="true" />
				<span>
					Hapus variabel proyek yang bertanda "Menimpa bucket" di atas kalau aplikasimu harus
					memakai nilai dari bucket.
				</span>
			</p>
		{/if}

		{#if needsDiskHint}
			<div
				class="flex flex-col gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="bucket-filesystem-disk-hint"
			>
				<p>{BUCKET_COPY.filesystemDiskHint}</p>
				{#if !readOnly}
					<Button
						variant="secondary"
						size="sm"
						class="self-start"
						onclick={addFilesystemDisk}
						disabled={addMutation.isPending}
						data-testid="add-filesystem-disk"
					>
						<Plus size={16} weight="bold" aria-hidden="true" />
						{addMutation.isPending
							? 'Menambahkan...'
							: `Tambahkan ${LARAVEL_FILESYSTEM_DISK.key}=${LARAVEL_FILESYSTEM_DISK.value}`}
					</Button>
				{/if}
				{#if diskError}
					<p role="alert" class="text-error-dark">{diskError}</p>
				{/if}
			</div>
		{/if}
	</section>
{:else if offerBucket}
	<p class="mt-3 text-sm text-muted" data-testid="bucket-variables-offer">
		Aplikasimu menyimpan file upload? Buat bucket, dan Sakala menambahkan variabel
		<code class="font-mono text-xs text-foreground">AWS_*</code> saat deploy.
		<CreateProjectBucketLink projectId={project.id} />
	</p>
{/if}
