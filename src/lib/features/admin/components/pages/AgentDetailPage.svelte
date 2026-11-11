<script lang="ts">
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import type { ProvisionedAgent } from '$lib/api/resources/admin/agents';
	import { formatDuration, formatRelativeTime } from '$lib/utils/date';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import DescriptionList from '../DescriptionList.svelte';
	import FilterSelect from '../FilterSelect.svelte';
	import ListPagination from '../ListPagination.svelte';
	import ReasonDialog from '../ReasonDialog.svelte';
	import TokenOnceDialog from '../TokenOnceDialog.svelte';
	import { publicConfig } from '$lib/config/public';
	import {
		createAdminAgentQuery,
		createAgentCommandQuery,
		createAgentCommandsQuery
	} from '../../queries';
	import { createRevokeAgentMutation, createRotateAgentMutation } from '../../mutations';
	import { useListUrl } from '../../list-url.svelte';
	import { readListState, toApiParams } from '../../url-state';
	import {
		COMMAND_STATUS_OPTIONS,
		agentStatus,
		authStatus,
		commandStatus,
		formatNumber,
		formatWibDateTime
	} from '../../format';

	let { id }: { id: string } = $props();

	const COMMAND_TYPES = [
		'DeployProject',
		'InspectProject',
		'RestartProject',
		'StopProject',
		'SleepProject',
		'WakeProject',
		'HealthCheck',
		'RefreshRoute',
		'ReconcileWorkload',
		'CleanupRuntime',
		'DrainNode',
		'ResumeNode'
	];
	const SPEC = {
		type: COMMAND_TYPES,
		status: COMMAND_STATUS_OPTIONS.map((option) => option.value)
	} as const;

	const DESIRED_STATE: Record<string, string> = {
		active: 'Aktif',
		draining: 'Mengosongkan',
		drained: 'Kosong',
		maintenance: 'Pemeliharaan'
	};

	const url = useListUrl();
	const list = $derived(readListState(url.search, SPEC));

	const query = createAdminAgentQuery(() => id);
	const commandsQuery = createAgentCommandsQuery(
		() => id,
		() => toApiParams(list)
	);
	const agent = $derived(query.data);

	let selectedCommand = $state<string | null>(null);
	const commandQuery = createAgentCommandQuery(
		() => id,
		() => selectedCommand
	);

	const rotate = createRotateAgentMutation();
	const revoke = createRevokeAgentMutation();
	let dialog = $state<'rotate' | 'revoke' | null>(null);
	let dialogError = $state<unknown>(null);
	let rotated = $state<ProvisionedAgent | null>(null);

	function open(kind: 'rotate' | 'revoke') {
		dialogError = null;
		dialog = kind;
	}

	async function confirm(reason: string) {
		if (!agent) return;
		dialogError = null;
		try {
			if (dialog === 'rotate') {
				rotated = await rotate.mutateAsync({ id: agent.id, reason });
				rotate.reset();
			} else {
				await revoke.mutateAsync({ id: agent.id, reason });
				toast.success(`Token ${agent.name} dicabut.`);
			}
			dialog = null;
		} catch (error) {
			dialogError = error;
		}
	}

	const revoked = $derived(agent?.auth_status === 'revoked');
</script>

<AdminPageHeader
	title={agent?.name ?? 'Runtime node'}
	documentTitle={agent ? `${agent.name} · Runtime node` : 'Runtime node'}
	crumbs={[
		{ label: 'Runtime node', href: resolve('/admin/agents') },
		{ label: agent?.name ?? '...' }
	]}
>
	{#if agent}
		{@const status = agentStatus(agent.status)}
		{@const auth = authStatus(agent.auth_status)}
		<div class="flex flex-wrap items-center gap-2">
			<Badge tone={status.tone}>{status.label}</Badge>
			<Badge tone={auth.tone}>{auth.label}</Badge>
			<code class="font-mono text-xs wrap-anywhere text-muted">{agent.agent_id}</code>
		</div>
	{/if}
	{#snippet actions()}
		{#if agent}
			<Button variant="secondary" onclick={() => open('rotate')}>Buat token baru</Button>
			{#if !revoked}
				<Button variant="danger" onclick={() => open('revoke')}>Cabut token</Button>
			{/if}
		{/if}
	{/snippet}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="node" onRetry={() => query.refetch()} />
{:else if !agent}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	<DescriptionList
		items={[
			{ label: 'Hostname', value: agent.hostname, mono: true },
			{ label: 'Docker network', value: agent.runtime_network, mono: true },
			{ label: 'Versi agent', value: agent.agent_version ?? 'Belum melapor', mono: true },
			{ label: 'Protokol', value: agent.protocol_version },
			{ label: 'Kemampuan', value: agent.capabilities.join(', ') || '-', mono: true },
			{
				label: 'Keadaan yang diminta',
				value: DESIRED_STATE[agent.desired_state] ?? agent.desired_state
			},
			{ label: 'Workload aktif', value: formatNumber(agent.active_workload_count ?? 0) },
			{ label: 'Command terbuka', value: formatNumber(agent.open_commands_count ?? 0) },
			{ label: 'Prefix token', value: agent.token_prefix, mono: true },
			{ label: 'Terdaftar', value: formatWibDateTime(agent.registered_at) },
			{
				label: 'Heartbeat terakhir',
				value: agent.last_seen_at
					? `${formatWibDateTime(agent.last_seen_at)} (${formatRelativeTime(agent.last_seen_at)})`
					: 'Belum pernah terhubung'
			},
			{ label: 'Deskripsi', value: agent.description }
		]}
	/>
	<p class="mt-2 text-xs text-muted">
		Log proses sakala-agent tidak dikirim ke API, jadi tidak tampil di sini. Output deploy ada di
		log deployment-nya.
	</p>

	<section aria-labelledby="command-history" class="mt-8">
		<h2 id="command-history" class="mb-3 text-base">Riwayat command</h2>
		<div class="mb-4 flex flex-wrap items-end gap-3">
			<FilterSelect
				id="commands-type"
				label="Command"
				value={list.type}
				options={COMMAND_TYPES.map((value) => ({ value, label: value }))}
				onChange={(value) => url.update({ type: value })}
			/>
			<FilterSelect
				id="commands-status"
				label="Status"
				value={list.status}
				options={COMMAND_STATUS_OPTIONS}
				onChange={(value) => url.update({ status: value })}
			/>
			{#if list.type || list.status}
				<Button
					variant="secondary"
					size="lg"
					onclick={() => url.update({ type: null, status: null })}>Hapus filter</Button
				>
			{/if}
		</div>
		{#if commandsQuery.isError && !commandsQuery.data}
			<AdminError
				error={commandsQuery.error}
				what="riwayat command"
				onRetry={() => commandsQuery.refetch()}
			/>
		{:else}
			<AdminTable
				caption="Riwayat command node"
				columns={[
					{ label: 'Command' },
					{ label: 'Proyek' },
					{ label: 'Status' },
					{ label: 'Dibuat' },
					{ label: 'Durasi' },
					{ label: 'Detail', srOnly: true }
				]}
				loading={commandsQuery.isPending}
				fetching={commandsQuery.isPlaceholderData}
				empty={commandsQuery.data?.data.length === 0}
				emptyTitle="Belum ada command"
				emptyText={list.type || list.status
					? 'Ubah atau hapus filter.'
					: 'Node ini belum menerima command apa pun.'}
			>
				{#snippet rows()}
					{#each commandsQuery.data?.data ?? [] as command (command.id)}
						{@const status = commandStatus(command.status)}
						<tr>
							<td class="px-4 py-3 font-mono text-xs font-medium">{command.type}</td>
							<td class="px-4 py-3">
								{#if command.project}
									{#if command.project.deleted}{command.project.name} (dihapus){:else}
										<a
											href={resolve(`/admin/projects/${command.project.id}`)}
											class="inline-flex min-h-6 items-center underline underline-offset-2"
											>{command.project.name}</a
										>
									{/if}
								{:else}<span class="text-muted">Tingkat node</span>{/if}
							</td>
							<td class="px-4 py-3">
								<Badge tone={status.tone}>{status.label}</Badge>
								{#if command.error_code}<p class="mt-1 font-mono text-xs text-muted">
										{command.error_code}
									</p>{/if}
							</td>
							<td class="px-4 py-3 whitespace-nowrap">{formatWibDateTime(command.created_at)}</td>
							<td class="px-4 py-3 whitespace-nowrap"
								>{command.duration_seconds === null
									? '-'
									: formatDuration(command.duration_seconds)}</td
							>
							<td class="px-4 py-3 text-right">
								{#if command.type === 'DeployProject' && command.deployment_id}
									<a
										href={resolve(`/admin/deployments/${command.deployment_id}`)}
										class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
									>
										Log deployment<span class="sr-only"> {command.type}</span>
									</a>
								{:else}
									<Button variant="link" onclick={() => (selectedCommand = command.id)}>
										Laporan<span class="sr-only">
											{command.type} {formatWibDateTime(command.created_at)}</span
										>
									</Button>
								{/if}
							</td>
						</tr>
					{/each}
				{/snippet}
			</AdminTable>
			<ListPagination
				meta={commandsQuery.data?.meta}
				noun="command"
				busy={commandsQuery.isFetching}
				onPageChange={(page) => url.update({ page })}
			/>
		{/if}
	</section>

	<Dialog
		open={selectedCommand !== null}
		title={commandQuery.data ? `${commandQuery.data.type}` : 'Laporan command'}
		class="max-w-2xl"
		titleClass="text-left"
		cancelLabel="Tutup"
		confirmLabel="Muat ulang"
		emphasis="cancel"
		onConfirm={() => commandQuery.refetch()}
		onCancel={() => (selectedCommand = null)}
	>
		{#if commandQuery.isPending}
			<div class="skeleton h-24 w-full"></div>
		{:else if commandQuery.isError}
			<AdminError
				error={commandQuery.error}
				what="laporan command"
				onRetry={() => commandQuery.refetch()}
			/>
		{:else if commandQuery.data}
			{@const command = commandQuery.data}
			<div class="flex flex-col gap-3 text-left text-sm">
				<p>
					{commandStatus(command.status).label} · percobaan {command.attempts}
					{#if command.error_message}· <span class="wrap-anywhere">{command.error_message}</span
						>{/if}
				</p>
				{#if (command.reports ?? []).length === 0}
					<p class="text-muted">Node tidak mengirim laporan untuk command ini.</p>
				{:else}
					<pre
						class="max-h-80 overflow-auto rounded-control bg-terminal p-3 font-mono text-xs text-terminal-text">{(
							command.reports ?? []
						)
							.map(
								(report) =>
									`[${report.occurred_at ? formatWibDateTime(report.occurred_at) : '-'}] ${report.stream === 'stderr' ? 'stderr: ' : ''}${report.message}`
							)
							.join('\n')}</pre>
				{/if}
			</div>
		{/if}
	</Dialog>

	<ReasonDialog
		open={dialog !== null}
		id={`agent-${dialog ?? 'action'}`}
		title={dialog === 'rotate' ? 'Buat token baru?' : 'Cabut token node?'}
		subject={`${agent.name} (${agent.agent_id})`}
		consequence={dialog === 'rotate'
			? 'Token lama langsung tidak berlaku. Agent berhenti terhubung sampai token baru dipasang di konfigurasinya.'
			: 'Node tidak bisa autentikasi atau menerima command lagi. Workload yang sedang berjalan di sana tidak dipindahkan otomatis. Token baru bisa dibuat nanti.'}
		confirmLabel={dialog === 'rotate' ? 'Buat token baru' : 'Cabut token'}
		variant="destructive"
		error={dialogError}
		onCancel={() => (dialog = null)}
		onConfirm={confirm}
	/>

	{#if rotated}
		<TokenOnceDialog
			open={true}
			rotated
			token={rotated.token}
			agentId={rotated.agent.agent_id}
			agentName={rotated.agent.name}
			apiUrl={publicConfig.apiUrl}
			onDone={() => {
				rotated = null;
				toast.success('Token baru tersimpan. Pasang di sakala-agent.');
			}}
		/>
	{/if}
{/if}
