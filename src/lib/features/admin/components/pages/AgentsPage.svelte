<script lang="ts">
	import { resolve } from '$app/paths';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { getFieldError } from '$lib/api/errors';
	import type { ProvisionedAgent } from '$lib/api/resources/admin/agents';
	import { formatRelativeTime } from '$lib/utils/date';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import ListToolbar from '../ListToolbar.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import MetricCard from '../MetricCard.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import TokenOnceDialog from '../TokenOnceDialog.svelte';
	import { publicConfig } from '$lib/config/public';
	import { createAdminAgentsQuery, createAdminCountQuery } from '../../queries';
	import { createProvisionAgentMutation } from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import {
		AGENT_STATUS_OPTIONS,
		AUTH_STATUS_OPTIONS,
		agentName,
		agentStatus,
		authStatus,
		formatNumber,
		formatWibDate
	} from '../../format';

	const SPEC = {
		search: 'text',
		status: AGENT_STATUS_OPTIONS.map((option) => option.value),
		auth_status: AUTH_STATUS_OPTIONS.map((option) => option.value),
		never_seen: ['1']
	} as const;

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));
	const query = createAdminAgentsQuery(() => toApiParams(list));
	const hasFilters = $derived(
		Boolean(list.search || list.status || list.auth_status || list.never_seen)
	);

	const totalQuery = createAdminCountQuery('agents', () => ({}));
	const offlineQuery = createAdminCountQuery('agents', () => ({ status: 'offline' }));
	const neverSeenQuery = createAdminCountQuery('agents', () => ({ never_seen: '1' }));
	const revokedQuery = createAdminCountQuery('agents', () => ({ auth_status: 'revoked' }));

	const provision = createProvisionAgentMutation();
	let formOpen = $state(false);
	let formError = $state<unknown>(null);
	let name = $state('');
	let description = $state('');
	// Lives here only while its dialog is open, never in the query cache.
	let provisioned = $state<ProvisionedAgent | null>(null);

	function openForm() {
		formError = null;
		name = '';
		description = '';
		formOpen = true;
	}

	async function submit(reason: string) {
		formError = null;
		try {
			provisioned = await provision.mutateAsync({
				name: name.trim(),
				description: description.trim() || null,
				reason
			});
			provision.reset();
			formOpen = false;
		} catch (error) {
			formError = error;
		}
	}

	const nameInvalid = $derived(!name.trim() || name.length > 120);
</script>

<AdminPageHeader
	title="Runtime node"
	crumbs={[{ label: 'Runtime node' }]}
	description="Node yang menjalankan build dan deployment. Status berasal dari heartbeat terakhir agent."
>
	{#snippet actions()}
		<Button onclick={openForm}>
			<Plus size={16} weight="bold" aria-hidden="true" />
			Daftarkan node
		</Button>
	{/snippet}
</AdminPageHeader>

<section aria-labelledby="agents-summary" class="mb-6">
	<h2 id="agents-summary" class="sr-only">Ringkasan node</h2>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
		<MetricCard
			label="Node terdaftar"
			help="Semua node, termasuk yang tokennya dicabut."
			loading={totalQuery.isPending}
			value={formatNumber(totalQuery.data ?? 0)}
		/>
		<MetricCard
			label="Offline"
			help="Heartbeat berhenti. Deployment tidak dijadwalkan ke sana."
			tone="error"
			loading={offlineQuery.isPending}
			value={formatNumber(offlineQuery.data ?? 0)}
		/>
		<MetricCard
			label="Belum pernah terhubung"
			help="Token sudah dibuat, tapi agent belum mengirim heartbeat pertama."
			loading={neverSeenQuery.isPending}
			value={formatNumber(neverSeenQuery.data ?? 0)}
		/>
		<MetricCard
			label="Token dicabut"
			help="Node ini tidak bisa lagi autentikasi atau menerima command."
			loading={revokedQuery.isPending}
			value={formatNumber(revokedQuery.data ?? 0)}
		/>
	</div>
</section>

<ListToolbar
	id="agents"
	searchLabel="Cari nama, agent ID, atau hostname"
	search={list.search}
	onSearch={(value) => url.update({ search: value }, { replace: true })}
	{hasFilters}
	onReset={() => url.update({ search: null, status: null, auth_status: null, never_seen: null })}
>
	{#snippet filters()}
		<FilterSelect
			id="agents-status"
			label="Status"
			value={list.status}
			options={AGENT_STATUS_OPTIONS}
			onChange={(value) => url.update({ status: value })}
		/>
		<FilterSelect
			id="agents-auth"
			label="Token"
			value={list.auth_status}
			options={AUTH_STATUS_OPTIONS}
			onChange={(value) => url.update({ auth_status: value })}
		/>
		<FilterSelect
			id="agents-never"
			label="Heartbeat"
			value={list.never_seen}
			allLabel="Semua"
			options={[{ value: '1', label: 'Belum pernah terhubung' }]}
			onChange={(value) => url.update({ never_seen: value })}
		/>
	{/snippet}
</ListToolbar>

{#if query.isError && !query.data}
	<AdminError error={query.error} what="daftar node" onRetry={() => query.refetch()} />
{:else}
	<AdminTable
		caption="Daftar runtime node"
		columns={[
			{ label: 'Node' },
			{ label: 'Status' },
			{ label: 'Token' },
			{ label: 'Hostname' },
			{ label: 'Network' },
			{ label: 'Kemampuan' },
			{ label: 'Terakhir aktif' }
		]}
		loading={query.isPending}
		fetching={query.isPlaceholderData}
		empty={query.data?.data.length === 0}
		emptyTitle={hasFilters ? 'Tidak ada node yang cocok' : 'Belum ada node'}
		emptyText={hasFilters
			? 'Ubah pencarian atau hapus filter.'
			: 'Daftarkan node pertama, lalu pasang token-nya di sakala-agent.'}
	>
		{#snippet rows()}
			{#each query.data?.data ?? [] as agent (agent.id)}
				{@const status = agentStatus(agent.status)}
				{@const auth = authStatus(agent.auth_status)}
				<tr class="hover:bg-background">
					<td class="px-4 py-3">
						<a
							href={resolve(`/admin/agents/${agent.id}`)}
							class="inline-flex min-h-6 items-center font-medium underline underline-offset-2"
							>{agentName(agent)}</a
						>
						<p class="max-w-48 truncate font-mono text-xs text-muted" title={agent.agent_id}>
							{agent.agent_id}
						</p>
					</td>
					<td class="px-4 py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
					<td class="px-4 py-3"><Badge tone={auth.tone}>{auth.label}</Badge></td>
					<td class="px-4 py-3 font-mono text-xs">{agent.hostname ?? '-'}</td>
					<td class="px-4 py-3 font-mono text-xs">{agent.runtime_network ?? '-'}</td>
					<td class="px-4 py-3">
						<div class="flex flex-wrap gap-1">
							{#each agent.capabilities as capability (capability)}
								<span class="rounded-full bg-background-soft px-2 py-0.5 font-mono text-xs"
									>{capability}</span
								>
							{:else}<span class="text-muted">-</span>{/each}
						</div>
					</td>
					<td class="px-4 py-3 whitespace-nowrap">
						{#if agent.last_seen_at}
							{formatRelativeTime(agent.last_seen_at)}
						{:else}
							<span class="text-warning">Belum pernah</span>
							<p class="text-xs text-muted">
								dibuat {formatWibDate(agent.registered_at ?? agent.created_at)}
							</p>
						{/if}
					</td>
				</tr>
			{/each}
		{/snippet}
	</AdminTable>
	<ListPagination
		meta={query.data?.meta}
		noun="node"
		busy={query.isFetching}
		onPageChange={(page) => url.update({ page })}
	/>
{/if}

<ReasonDialog
	open={formOpen}
	id="agent-provision"
	title="Daftarkan runtime node"
	subject={name.trim() ? `Node baru ${name.trim()}` : 'Node baru'}
	consequence="Sakala membuat catatan node dan token untuknya. Token hanya tampil sekali setelah ini; simpan langsung di konfigurasi sakala-agent."
	confirmLabel="Buat dan tampilkan token"
	error={formError}
	fieldsInvalid={nameInvalid}
	onCancel={() => (formOpen = false)}
	onConfirm={submit}
>
	{#snippet fields()}
		<div class="space-y-1.5">
			<label for="agent-name" class="block text-sm font-medium">Nama node</label>
			<input
				id="agent-name"
				class="control-input"
				bind:value={name}
				maxlength="120"
				placeholder="agent-jkt-02"
				aria-describedby="agent-name-hint"
				aria-invalid={getFieldError(formError, 'name') ? 'true' : undefined}
			/>
			<p
				id="agent-name-hint"
				class="text-xs {getFieldError(formError, 'name')
					? 'text-error-base'
					: 'text-foreground/70'}"
			>
				{getFieldError(formError, 'name') ??
					'Nama untuk mengenali node ini, biasanya lokasi atau region server.'}
			</p>
		</div>
		<div class="space-y-1.5">
			<label for="agent-description" class="block text-sm font-medium">Deskripsi (opsional)</label>
			<input
				id="agent-description"
				class="control-input"
				bind:value={description}
				maxlength="500"
				placeholder="Node cadangan region Jogja"
			/>
		</div>
	{/snippet}
</ReasonDialog>

{#if provisioned}
	<TokenOnceDialog
		open={true}
		token={provisioned.token}
		agentId={provisioned.agent.agent_id}
		agentName={agentName(provisioned.agent)}
		apiUrl={publicConfig.apiUrl}
		onDone={() => (provisioned = null)}
	/>
{/if}
