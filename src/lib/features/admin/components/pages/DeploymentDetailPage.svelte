<script lang="ts">
	import { resolve } from '$app/paths';
	import XCircle from 'phosphor-svelte/lib/XCircle';
	import Badge from '$lib/components/ui/Badge.svelte';
	import DeploymentTimeline from '$lib/features/deployments/components/DeploymentTimeline.svelte';
	import DeploymentLogConsole from '$lib/features/deployments/components/DeploymentLogConsole.svelte';
	import { normalizeDeploymentTimeline } from '$lib/features/deployments/deployment-normalization';
	import { flattenLogPages } from '$lib/features/deployments/deployment-logs';
	import { formatDuration } from '$lib/utils/date';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import DescriptionList from '../DescriptionList.svelte';
	import {
		createAdminDeploymentEventsQuery,
		createAdminDeploymentLogsQuery,
		createAdminDeploymentQuery
	} from '../../queries';
	import { deploymentStatus, failureCategoryLabel, formatWibDateTime } from '../../format';

	let { id }: { id: string } = $props();

	const query = createAdminDeploymentQuery(() => id);
	const eventsQuery = createAdminDeploymentEventsQuery(() => id);
	const logsQuery = createAdminDeploymentLogsQuery(() => id);

	const detail = $derived(query.data);
	const deployment = $derived(detail?.deployment);
	const failure = $derived(deployment?.failure ?? null);
	const steps = $derived(
		deployment && eventsQuery.data ? normalizeDeploymentTimeline(deployment, eventsQuery.data) : []
	);
	const lines = $derived(flattenLogPages(logsQuery.data?.pages ?? []));
	const title = $derived(
		detail ? `${detail.project?.name ?? 'Proyek dihapus'} #${deployment?.sequence}` : 'Deployment'
	);
</script>

<AdminPageHeader
	{title}
	documentTitle={`${title} · Deployment`}
	crumbs={[{ label: 'Analisis kegagalan', href: resolve('/admin/failures') }, { label: title }]}
	description="Detail deployment, timeline tahapnya, dan log yang dilaporkan node."
>
	{#if deployment}
		{@const status = deploymentStatus(deployment.status)}
		<Badge tone={status.tone}>{status.label}</Badge>
	{/if}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="deployment" onRetry={() => query.refetch()} />
{:else if !detail || !deployment}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	{#if failure}
		<div class="mb-6 flex gap-3 rounded-card border border-error/20 bg-error-50 p-5" role="status">
			<XCircle size={24} class="shrink-0 text-error" aria-hidden="true" />
			<div class="min-w-0">
				<p class="font-semibold text-error-dark">
					{failureCategoryLabel(failure.category)}: {failure.summary}
				</p>
				{#if failure.detail}
					<p class="mt-1 font-mono text-sm wrap-anywhere text-error-dark">{failure.detail}</p>
				{/if}
				<p class="mt-2 text-sm text-foreground">
					{failure.user_fixable
						? 'Perbaikan ada di sisi pemilik proyek.'
						: 'Gangguan ada di sisi Sakala; pemilik cukup men-deploy ulang.'}
					Saran untuk pemilik: {failure.recovery_hint}
				</p>
				<p class="mt-1 font-mono text-xs text-muted">
					{failure.code}{failure.stage ? ` · tahap ${failure.stage}` : ''}
				</p>
			</div>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-5">
		<section aria-labelledby="deployment-info" class="flex min-w-0 flex-col gap-3 lg:col-span-3">
			<h2 id="deployment-info" class="text-base">Informasi</h2>
			<DescriptionList
				items={[
					{ label: 'Proyek', content: projectLink },
					{ label: 'Commit', value: deployment.commit_sha?.slice(0, 7) ?? '-', mono: true },
					{ label: 'Pesan commit', value: deployment.commit_message },
					{ label: 'Branch', value: deployment.branch, mono: true },
					{ label: 'Pemicu', value: deployment.trigger },
					{ label: 'Diminta oleh', content: requester },
					{ label: 'Node', content: nodeLink },
					{ label: 'Dibuat', value: formatWibDateTime(deployment.created_at) },
					{
						label: 'Durasi',
						value: detail.duration_seconds === null ? '-' : formatDuration(detail.duration_seconds)
					}
				]}
			/>
		</section>
		<section
			aria-labelledby="deployment-timeline"
			class="flex min-w-0 flex-col gap-3 lg:col-span-2"
		>
			<h2 id="deployment-timeline" class="text-base">Timeline</h2>
			<div class="surface-card p-5">
				{#if eventsQuery.isPending}
					<div class="skeleton h-32 w-full"></div>
				{:else if eventsQuery.isError}
					<AdminError
						error={eventsQuery.error}
						what="timeline"
						onRetry={() => eventsQuery.refetch()}
					/>
				{:else if steps.length === 0}
					<p class="text-sm text-muted">Tidak ada tahap yang tercatat untuk deployment ini.</p>
				{:else}
					<DeploymentTimeline {steps} />
				{/if}
			</div>
		</section>
	</div>

	<section aria-labelledby="deployment-logs" class="mt-8 flex flex-col gap-3">
		<h2 id="deployment-logs" class="text-base">Log</h2>
		{#if logsQuery.isError}
			<AdminError error={logsQuery.error} what="log" onRetry={() => logsQuery.refetch()} />
		{:else if logsQuery.isPending}
			<div class="skeleton h-48 w-full"></div>
		{:else if lines.length === 0}
			<p class="surface-card p-5 text-sm text-muted">
				Tidak ada baris log. Log disimpan 7 hari, lalu dihapus.
			</p>
		{:else}
			<DeploymentLogConsole
				{lines}
				labelledBy="deployment-logs"
				hasOlder={logsQuery.hasNextPage}
				loadingOlder={logsQuery.isFetchingNextPage}
				onLoadOlder={() => logsQuery.fetchNextPage()}
			/>
		{/if}
	</section>
{/if}

{#snippet projectLink()}
	{#if detail?.project && !detail.project.deleted}
		<a
			href={resolve(`/admin/projects/${detail.project.id}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2">{detail.project.name}</a
		>
	{:else}{detail?.project ? `${detail.project.name} (dihapus)` : '-'}{/if}
{/snippet}

{#snippet requester()}
	{#if detail?.requested_by}
		<a
			href={resolve(`/admin/users/${String(detail.requested_by.id)}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2"
			>@{detail.requested_by.username}</a
		>
	{:else}Webhook atau akun dihapus{/if}
{/snippet}

{#snippet nodeLink()}
	{#if detail?.agent_node}
		<a
			href={resolve(`/admin/agents/${detail.agent_node.id}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2"
			>{detail.agent_node.name}</a
		>
	{:else}Belum dijadwalkan{/if}
{/snippet}
