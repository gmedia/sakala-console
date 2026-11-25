<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import LockSimple from 'phosphor-svelte/lib/LockSimple';
	import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
	import type { Valkey, ValkeyCredentials } from '$lib/api/resources/valkeys';
	import Button from '$lib/components/ui/Button.svelte';
	import CredentialRow from '$lib/features/databases/components/CredentialRow.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import type { ValkeyAccess } from '../access';
	import { createRevealValkeyCredentialsMutation } from '../mutations';
	import {
		PASSWORD_ROTATION_COPY,
		VALKEY_COPY,
		VALKEY_VARIABLES,
		isOnNode,
		isPasswordUnknown,
		valkeyEnvBlock,
		valkeyErrorMessage
	} from '../presentation';
	import PasswordRotationSection from './PasswordRotationSection.svelte';

	type Props = {
		valkey: Valkey;
		workspaceId: string;
		access: ValkeyAccess;
	};

	let { valkey, workspaceId, access }: Props = $props();

	const revealMutation = createRevealValkeyCredentialsMutation();

	// Held here only, never in the query cache, and dropped on Sembunyikan, a rotation, leaving the
	// page, or the component going away.
	let credentials = $state<ValkeyCredentials | null>(null);
	let revealError = $state<string | null>(null);

	const onNode = $derived(isOnNode(valkey));
	const passwordUnknown = $derived(isPasswordUnknown(valkey));

	async function reveal() {
		revealError = null;
		try {
			credentials = await revealMutation.mutateAsync({ workspaceId, valkeyId: valkey.id });
		} catch (error) {
			revealError = valkeyErrorMessage(
				error,
				'credentials',
				'Password belum bisa ditampilkan. Muat ulang halaman, lalu tampilkan lagi.'
			);
		} finally {
			// The mutation keeps its last answer; nothing but `credentials` should hold the password.
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

	// Not secret, and every member reads it; `null` until the store runs on its node.
	const connection = $derived(valkey.connection);
	const publicRows = $derived([
		{ label: 'Host (REDIS_HOST)', value: connection?.host ?? null },
		{ label: 'Port (REDIS_PORT)', value: connection ? String(connection.port) : null }
	]);
	const envBlock = $derived(credentials ? valkeyEnvBlock(credentials.variables) : null);

	async function copyEnv() {
		if (!envBlock) return;
		await copyWithToast(envBlock, {
			success: 'Variabel Valkey disalin. Jangan menaruhnya di repository.',
			failure: 'Browser menolak akses clipboard. Salin variabelnya secara manual.'
		});
	}
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="valkey-connection-title"
	data-testid="valkey-connection"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 basis-64 flex-col gap-1">
			<h2 id="valkey-connection-title" class="text-base text-foreground">Koneksi</h2>
			<p class="flex items-start gap-2 text-sm text-muted">
				<ShieldCheck size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
				<span>{VALKEY_COPY.privateNote}</span>
			</p>
		</div>
		{#if access.canViewCredentials && onNode}
			{#if credentials}
				<Button variant="secondary" size="sm" onclick={hide} data-testid="hide-valkey-credentials">
					<EyeSlash size={16} aria-hidden="true" />
					Sembunyikan
				</Button>
			{:else}
				<Button
					variant="secondary"
					size="sm"
					onclick={reveal}
					disabled={revealMutation.isPending || passwordUnknown}
					aria-describedby="valkey-credentials-audit-note"
					data-testid="reveal-valkey-credentials"
				>
					<Eye size={16} aria-hidden="true" />
					{revealMutation.isPending ? 'Memuat...' : VALKEY_COPY.reveal}
				</Button>
			{/if}
		{/if}
	</div>

	{#if !onNode}
		<p class="text-sm text-muted" data-testid="valkey-credentials-not-ready">
			{VALKEY_COPY.credentialsNotReady}
		</p>
	{:else}
		<dl class="flex flex-col divide-y divide-border" data-testid="valkey-credentials">
			{#each publicRows as row (row.label)}
				<CredentialRow label={row.label} value={row.value} missingText="Belum dilaporkan" />
			{/each}
			{#if access.canViewCredentials}
				<!-- `undefined` keeps the row masked until the owner reveals it. -->
				<CredentialRow
					label="Password (REDIS_PASSWORD)"
					value={credentials?.password}
					missingText="Belum dilaporkan"
				/>
			{/if}
		</dl>

		{#if access.canViewCredentials}
			<p id="valkey-credentials-audit-note" class="text-xs text-muted">
				{VALKEY_COPY.credentialsAudit}
			</p>
			{#if passwordUnknown}
				<p class="text-sm text-foreground" data-testid="valkey-credentials-password-unknown">
					{PASSWORD_ROTATION_COPY.unknownReveal}
				</p>
			{/if}
			{#if revealError}
				<p role="alert" class="text-sm text-error-dark" data-testid="valkey-credentials-error">
					{revealError}
				</p>
			{/if}
			{#if envBlock}
				<div class="flex flex-col gap-2" data-testid="valkey-env-block">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 class="text-sm font-semibold text-foreground">{VALKEY_COPY.envBlockTitle}</h3>
						<Button variant="ghost" size="sm" onclick={copyEnv}>
							<Copy size={16} aria-hidden="true" />
							{VALKEY_COPY.envBlockCopy}
						</Button>
					</div>
					<pre
						class="overflow-x-auto rounded-control bg-background-soft px-3 py-2 font-mono text-xs text-foreground"
						aria-label="Variabel Valkey">{envBlock}</pre>
					<p class="text-xs text-muted">{VALKEY_COPY.envBlockNote}</p>
				</div>
			{/if}
		{:else}
			<p
				class="flex items-start gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="valkey-credentials-owner-only"
			>
				<LockSimple size={18} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
				{VALKEY_COPY.credentialsOwnerOnly}
			</p>
		{/if}
	{/if}

	<div class="flex flex-col gap-1">
		<p class="text-xs font-medium text-muted">Variabel yang diterima proyek terpasang</p>
		<ul class="flex flex-wrap gap-1.5" aria-label="Variabel Valkey">
			{#each VALKEY_VARIABLES as name (name)}
				<li
					class="rounded-control bg-background-soft px-2 py-0.5 font-mono text-xs text-foreground"
				>
					{name}
				</li>
			{/each}
		</ul>
	</div>

	<PasswordRotationSection {valkey} {workspaceId} {access} onRequested={hide} />
</section>
