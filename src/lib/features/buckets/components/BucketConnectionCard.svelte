<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import Globe from 'phosphor-svelte/lib/Globe';
	import LockSimple from 'phosphor-svelte/lib/LockSimple';
	import type { Bucket, BucketCredentials } from '$lib/api/resources/buckets';
	import Button from '$lib/components/ui/Button.svelte';
	import CredentialRow from '$lib/features/databases/components/CredentialRow.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import type { BucketAccess } from '../access';
	import { createRevealBucketCredentialsMutation } from '../mutations';
	import {
		BUCKET_COPY,
		BUCKET_VARIABLES,
		KEY_ROTATION_COPY,
		bucketEnvBlock,
		bucketErrorMessage,
		isKeyUnknown,
		isOnNode
	} from '../presentation';
	import KeyRotationSection from './KeyRotationSection.svelte';

	type Props = {
		bucket: Bucket;
		workspaceId: string;
		access: BucketAccess;
	};

	let { bucket, workspaceId, access }: Props = $props();

	const revealMutation = createRevealBucketCredentialsMutation();

	// Held here only, never in the query cache, and dropped on Sembunyikan, a rotation, leaving the
	// page, or the component going away.
	let credentials = $state<BucketCredentials | null>(null);
	let revealError = $state<string | null>(null);

	const onNode = $derived(isOnNode(bucket));
	const keyUnknown = $derived(isKeyUnknown(bucket));

	async function reveal() {
		revealError = null;
		try {
			credentials = await revealMutation.mutateAsync({ workspaceId, bucketId: bucket.id });
		} catch (error) {
			revealError = bucketErrorMessage(
				error,
				'credentials',
				'Secret key belum bisa ditampilkan. Muat ulang halaman, lalu tampilkan lagi.'
			);
		} finally {
			// The mutation keeps its last answer; nothing but `credentials` should hold the secret.
			revealMutation.reset();
		}
	}

	function hide() {
		credentials = null;
	}

	beforeNavigate(hide);
	onDestroy(() => {
		credentials = null;
		revealMutation.reset();
	});

	// Not secret, and every member reads it; `null` until the node reports its endpoint.
	const connection = $derived(bucket.connection);
	const publicRows = $derived([
		{ label: 'Endpoint', value: connection?.endpoint ?? null },
		{ label: 'Region S3', value: connection?.region ?? null },
		{ label: 'Bucket', value: connection?.bucket ?? null },
		{ label: 'Access key ID', value: connection?.access_key_id ?? null },
		{ label: 'Path-style', value: connection ? (connection.path_style ? 'Ya' : 'Tidak') : null }
	]);
	const envBlock = $derived(credentials?.variables ? bucketEnvBlock(credentials.variables) : null);

	async function copyEnv() {
		if (!envBlock) return;
		await copyWithToast(envBlock, {
			success: 'Variabel bucket disalin. Jangan menaruhnya di repository.',
			failure: 'Browser menolak akses clipboard. Salin variabelnya secara manual.'
		});
	}
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="bucket-connection-title"
	data-testid="bucket-connection"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
			<h2 id="bucket-connection-title" class="text-base text-foreground">Koneksi</h2>
			<p class="flex items-start gap-2 text-sm text-muted">
				<Globe size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
				<span>{BUCKET_COPY.publicEndpoint}</span>
			</p>
		</div>
		{#if access.canViewCredentials && onNode}
			{#if credentials}
				<Button variant="secondary" size="sm" onclick={hide} data-testid="hide-bucket-credentials">
					<EyeSlash size={16} aria-hidden="true" />
					Sembunyikan
				</Button>
			{:else}
				<Button
					variant="secondary"
					size="sm"
					onclick={reveal}
					disabled={revealMutation.isPending || keyUnknown}
					aria-describedby="bucket-credentials-audit-note"
					data-testid="reveal-bucket-credentials"
				>
					<Eye size={16} aria-hidden="true" />
					{revealMutation.isPending ? 'Memuat...' : BUCKET_COPY.reveal}
				</Button>
			{/if}
		{/if}
	</div>

	{#if !onNode}
		<p class="text-sm text-muted" data-testid="bucket-credentials-not-ready">
			{BUCKET_COPY.credentialsNotReady}
		</p>
	{:else}
		<dl class="flex flex-col divide-y divide-border" data-testid="bucket-credentials">
			{#each publicRows as row (row.label)}
				<CredentialRow
					label={row.label}
					value={row.value}
					missingText={BUCKET_COPY.endpointMissing}
				/>
			{/each}
			{#if access.canViewCredentials}
				<!-- `undefined` keeps the row masked until the owner reveals it. -->
				<CredentialRow
					label="Secret access key"
					value={credentials?.secret_access_key}
					missingText={BUCKET_COPY.endpointMissing}
				/>
			{/if}
		</dl>
		{#if !connection}
			<p class="text-sm text-foreground" data-testid="bucket-connection-pending">
				{BUCKET_COPY.endpointPending}
			</p>
		{/if}

		{#if access.canViewCredentials}
			<p id="bucket-credentials-audit-note" class="text-xs text-muted">
				{BUCKET_COPY.credentialsAudit}
			</p>
			{#if keyUnknown}
				<p class="text-sm text-foreground" data-testid="bucket-credentials-key-unknown">
					{KEY_ROTATION_COPY.unknownReveal}
				</p>
			{/if}
			{#if revealError}
				<p role="alert" class="text-sm text-error-dark" data-testid="bucket-credentials-error">
					{revealError}
				</p>
			{/if}
			{#if envBlock}
				<div class="flex flex-col gap-2" data-testid="bucket-env-block">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="text-sm font-semibold text-foreground">{BUCKET_COPY.envBlockTitle}</h3>
						<Button variant="ghost" size="sm" onclick={copyEnv}>
							<Copy size={16} aria-hidden="true" />
							{BUCKET_COPY.envBlockCopy}
						</Button>
					</div>
					<pre
						class="overflow-x-auto rounded-control bg-background-soft px-3 py-2 font-mono text-xs text-foreground"
						aria-label="Variabel bucket untuk file .env">{envBlock}</pre>
					<p class="text-xs text-muted">
						Proyek yang terpasang sudah menerima variabel ini otomatis. Salin hanya untuk laptop
						atau server lain.
					</p>
				</div>
			{/if}
		{:else}
			<p
				class="flex items-start gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="bucket-credentials-owner-only"
			>
				<LockSimple size={18} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
				{BUCKET_COPY.credentialsOwnerOnly}
			</p>
		{/if}
	{/if}

	<div class="flex flex-col gap-1">
		<p class="text-xs font-medium text-muted">Variabel yang diterima proyek terpasang</p>
		<ul class="flex flex-wrap gap-1.5" aria-label="Variabel bucket">
			{#each BUCKET_VARIABLES as name (name)}
				<li
					class="rounded-control bg-background-soft px-2 py-0.5 font-mono text-xs text-foreground"
				>
					{name}
				</li>
			{/each}
		</ul>
	</div>

	<KeyRotationSection {bucket} {workspaceId} {access} onRequested={hide} />
</section>
