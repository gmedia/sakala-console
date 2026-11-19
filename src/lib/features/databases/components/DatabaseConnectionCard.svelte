<script lang="ts">
	import Eye from 'phosphor-svelte/lib/Eye';
	import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
	import LockSimple from 'phosphor-svelte/lib/LockSimple';
	import type { Database, DatabaseCredentials } from '$lib/api/resources/databases';
	import Button from '$lib/components/ui/Button.svelte';
	import type { DatabaseAccess } from '../access';
	import { createRevealCredentialsMutation } from '../mutations';
	import {
		DATABASE_COPY,
		DATABASE_VARIABLES,
		databaseErrorMessage,
		isOnNode
	} from '../presentation';
	import CredentialRow from './CredentialRow.svelte';
	import PasswordRotationSection from './PasswordRotationSection.svelte';

	type Props = {
		database: Database;
		workspaceId: string;
		access: DatabaseAccess;
	};

	let { database, workspaceId, access }: Props = $props();

	const revealMutation = createRevealCredentialsMutation();

	// Held here only, never in the query cache, and dropped on Sembunyikan or a rotation.
	let credentials = $state<DatabaseCredentials | null>(null);
	let revealError = $state<string | null>(null);

	const onNode = $derived(isOnNode(database));

	async function reveal() {
		revealError = null;
		try {
			credentials = await revealMutation.mutateAsync({ workspaceId, databaseId: database.id });
		} catch (error) {
			revealError = databaseErrorMessage(
				error,
				'credentials',
				'Kredensial belum bisa ditampilkan. Silakan coba lagi.'
			);
		}
	}

	function hide() {
		credentials = null;
	}

	// Not secret, and every member reads it; `null` until the node reports its address.
	const connection = $derived(database.connection);
	const publicRows = $derived([
		{ label: 'Host', value: connection?.host ?? null },
		{ label: 'Port', value: connection ? String(connection.port) : null },
		{ label: 'Database', value: connection?.database ?? null },
		{ label: 'User', value: connection?.username ?? null }
	]);
	// `undefined` keeps a row masked until the owner reveals it.
	const secretRows = $derived([
		{ label: 'Password', value: credentials?.password },
		{ label: DATABASE_VARIABLES[0], value: credentials ? credentials.url : undefined }
	]);
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-4 p-4 sm:p-6"
	aria-labelledby="database-connection-title"
	data-testid="database-connection"
>
	<div class="flex min-w-0 flex-wrap items-start justify-between gap-3">
		<div class="flex min-w-0 flex-col gap-1">
			<h2 id="database-connection-title" class="text-base text-foreground">Koneksi</h2>
			<p class="text-sm text-muted">{DATABASE_COPY.privateNetwork}</p>
		</div>
		{#if access.canViewCredentials && onNode}
			{#if credentials}
				<Button variant="secondary" size="sm" onclick={hide}>
					<EyeSlash size={16} aria-hidden="true" />
					Sembunyikan
				</Button>
			{:else}
				<Button
					variant="secondary"
					size="sm"
					onclick={reveal}
					disabled={revealMutation.isPending}
					aria-describedby="credentials-audit-note"
					data-testid="reveal-credentials"
				>
					<Eye size={16} aria-hidden="true" />
					{revealMutation.isPending ? 'Memuat...' : DATABASE_COPY.reveal}
				</Button>
			{/if}
		{/if}
	</div>

	{#if !onNode}
		<p class="text-sm text-muted" data-testid="credentials-not-ready">
			{DATABASE_COPY.credentialsNotReady}
		</p>
	{:else}
		<dl class="flex flex-col divide-y divide-border" data-testid="credentials">
			{#each publicRows as row (row.label)}
				<CredentialRow
					label={row.label}
					value={row.value}
					missingText={DATABASE_COPY.endpointMissing}
				/>
			{/each}
			{#if access.canViewCredentials}
				{#each secretRows as row (row.label)}
					<CredentialRow
						label={row.label}
						value={row.value}
						missingText={DATABASE_COPY.endpointMissing}
					/>
				{/each}
			{/if}
		</dl>
		{#if !connection}
			<p class="text-sm text-foreground" data-testid="connection-pending">
				{DATABASE_COPY.endpointPending}
			</p>
		{/if}
		{#if access.canViewCredentials}
			<p id="credentials-audit-note" class="text-xs text-muted">{DATABASE_COPY.credentialsAudit}</p>
			{#if revealError}
				<p role="alert" class="text-sm text-error-dark">{revealError}</p>
			{/if}
		{:else}
			<p
				class="flex items-start gap-2 rounded-control border border-border bg-background-soft px-4 py-3 text-sm text-foreground"
				data-testid="credentials-owner-only"
			>
				<LockSimple size={18} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
				{DATABASE_COPY.credentialsOwnerOnly}
			</p>
		{/if}
	{/if}

	<div class="flex flex-col gap-1">
		<p class="text-xs font-medium text-muted">Variabel yang diterima proyek terpasang</p>
		<ul class="flex flex-wrap gap-1.5" aria-label="Variabel koneksi">
			{#each DATABASE_VARIABLES as name (name)}
				<li
					class="rounded-control bg-background-soft px-2 py-0.5 font-mono text-xs text-foreground"
				>
					{name}
				</li>
			{/each}
		</ul>
	</div>

	<PasswordRotationSection {database} {workspaceId} {access} onRequested={hide} />
</section>
