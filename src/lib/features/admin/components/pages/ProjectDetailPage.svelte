<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import DescriptionList from '../DescriptionList.svelte';
	import ProjectControls from '../ProjectControls.svelte';
	import { createAdminProjectQuery } from '../../queries';
	import {
		deploymentStatus,
		formatNumber,
		formatWibDateTime,
		projectStatus,
		runtimeStatus
	} from '../../format';

	let { id }: { id: string } = $props();

	const query = createAdminProjectQuery(() => id);
	const detail = $derived(query.data);
	const project = $derived(detail?.project);

	const CONTROL_LABELS: Record<string, string> = {
		stop: 'Hentikan',
		suspend: 'Tangguhkan',
		unsuspend: 'Buka penangguhan',
		reconcile: 'Rekonsiliasi'
	};
</script>

<AdminPageHeader
	title={project?.name ?? 'Proyek'}
	documentTitle={project ? `${project.name} · Proyek` : 'Proyek'}
	crumbs={[
		{ label: 'Proyek', href: resolve('/admin/projects') },
		{ label: project?.name ?? '...' }
	]}
>
	{#if project}
		{@const runtime = runtimeStatus(project.runtime_status)}
		{@const status = projectStatus(project.status)}
		<div class="flex flex-wrap items-center gap-2">
			<Badge tone={runtime.tone}>Runtime: {runtime.label}</Badge>
			<Badge tone={status.tone}>Status: {status.label}</Badge>
		</div>
	{/if}
	{#snippet actions()}
		<Button variant="secondary" disabled={query.isFetching} onclick={() => query.refetch()}>
			<ArrowsClockwise size={16} aria-hidden="true" />
			Muat ulang
		</Button>
	{/snippet}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="proyek" onRetry={() => query.refetch()} />
{:else if !detail || !project}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	{#if project.suspension}
		<div
			class="mb-6 rounded-card border border-warning/30 bg-accent-soft p-4 text-sm"
			role="status"
		>
			<p class="font-semibold text-foreground">
				Ditangguhkan sejak {formatWibDateTime(project.suspension.suspended_at)}
			</p>
			<p class="mt-1 wrap-anywhere text-foreground">
				Alasan: {project.suspension.reason ?? 'tidak tercatat'}
			</p>
		</div>
	{/if}

	<div class="grid gap-6 lg:grid-cols-5">
		<div class="flex min-w-0 flex-col gap-6 lg:col-span-3">
			<DescriptionList
				items={[
					{ label: 'Workspace', content: workspaceLink },
					{ label: 'Pembuat', content: creatorLink },
					{
						label: 'Repository',
						value: project.repository_full_name ?? project.repository_url,
						mono: true
					},
					{ label: 'Branch', value: project.branch, mono: true },
					{ label: 'URL publik', value: project.public_url, mono: true },
					{ label: 'Port', value: detail.effective_port },
					{ label: 'Deployment', value: `${formatNumber(detail.deployments_count)} total` },
					{ label: 'Deployment terakhir', content: latestDeployment },
					{ label: 'Dibuat', value: formatWibDateTime(project.created_at) }
				]}
			/>
		</div>
		<div class="min-w-0 lg:col-span-2">
			<ProjectControls {project} />
		</div>
	</div>

	<section aria-labelledby="control-history" class="mt-8 flex flex-col gap-3">
		<h2 id="control-history" class="text-base">Riwayat kontrol admin</h2>
		<AdminTable
			caption="Riwayat kontrol admin"
			columns={[{ label: 'Aksi' }, { label: 'Alasan' }, { label: 'Admin' }, { label: 'Waktu' }]}
			empty={detail.control_requests.length === 0}
			emptyTitle="Belum ada kontrol admin untuk proyek ini"
		>
			{#snippet rows()}
				{#each detail.control_requests as request (request.id)}
					<tr>
						<td class="px-4 py-3 font-medium">{CONTROL_LABELS[request.action] ?? request.action}</td
						>
						<td class="px-4 py-3 wrap-anywhere">{request.reason}</td>
						<td class="px-4 py-3">
							<a
								href={resolve(`/admin/users/${request.actor_id}`)}
								class="inline-flex min-h-6 items-center underline underline-offset-2"
								>Pengguna #{request.actor_id}</a
							>
						</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatWibDateTime(request.created_at)}</td>
					</tr>
				{/each}
			{/snippet}
		</AdminTable>
	</section>
{/if}

{#snippet workspaceLink()}
	{#if project?.workspace}
		<a
			href={resolve(`/admin/workspaces/${project.workspace.id}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2"
			>{project.workspace.name}</a
		>
	{:else}-{/if}
{/snippet}

{#snippet creatorLink()}
	{#if project?.creator}
		<a
			href={resolve(`/admin/users/${String(project.creator.id)}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2"
			>{project.creator.name} (@{project.creator.username})</a
		>
	{:else}Akun sudah dihapus{/if}
{/snippet}

{#snippet latestDeployment()}
	{#if project?.latest_deployment}
		<a
			href={resolve(`/admin/deployments/${project.latest_deployment.id}`)}
			class="inline-flex min-h-6 items-center underline underline-offset-2"
			>{deploymentStatus(project.latest_deployment.status).label}, lihat detail</a
		>
	{:else}Belum pernah{/if}
{/snippet}
