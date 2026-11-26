<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LearnMore from '$lib/components/ui/LearnMore.svelte';
	import FormPageLayout from '$lib/components/layout/templates/FormPageLayout.svelte';
	import PanelNextSteps from '$lib/components/panel/PanelNextSteps.svelte';
	import PanelHelp from '$lib/components/panel/PanelHelp.svelte';
	import { ReloadIcon } from '$lib/components/icons';
	import type { ProjectControlAction } from '$lib/api/resources/admin/projects';
	import AdminPageHeader from '../AdminPageHeader.svelte';
	import AdminDangerZone from '../AdminDangerZone.svelte';
	import AdminError from '../AdminError.svelte';
	import AdminTable from '../AdminTable.svelte';
	import DescriptionList from '../DescriptionList.svelte';
	import ProjectControls from '../ProjectControls.svelte';
	import { createAdminProjectQuery } from '../../queries';
	import { ADMIN_PANEL_COPY, deriveAdminProjectSteps } from '../../panel';
	import {
		CONTROL_LABELS,
		DANGER_CONTROLS_BODY,
		DANGER_CONTROLS,
		NOT_SERVING_NOTE,
		availableControls
	} from '../../project-controls';
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

	let controls = $state<ReturnType<typeof ProjectControls> | null>(null);
	const available = $derived(project ? availableControls(project) : []);
	const safeControls = $derived(available.filter((action) => !DANGER_CONTROLS.includes(action)));
	const dangerActions = $derived(
		available
			.filter((action) => DANGER_CONTROLS.includes(action))
			.map((action) => ({
				id: action,
				label: CONTROL_LABELS[action],
				onclick: () => controls?.open(action)
			}))
	);
	const notServing = $derived(
		project !== undefined && project.status !== 'suspended' && project.active_deployment_id === null
	);
	const steps = $derived(detail ? deriveAdminProjectSteps(detail) : []);

	const label = (action: string) => CONTROL_LABELS[action as ProjectControlAction] ?? action;
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
			<ReloadIcon size={16} aria-hidden="true" />
			Muat ulang
		</Button>
		{#each safeControls as action (action)}
			<Button variant="secondary" onclick={() => controls?.open(action)}>
				{CONTROL_LABELS[action]}
			</Button>
		{/each}
	{/snippet}
</AdminPageHeader>

{#if query.isError}
	<AdminError error={query.error} what="proyek" onRetry={() => query.refetch()} />
{:else if !detail || !project}
	<div class="skeleton h-64 w-full" role="status" aria-label="Sedang memuat"></div>
{:else}
	{#snippet panel()}
		<PanelNextSteps {steps} />
		<PanelHelp>
			<LearnMore topic="hentikan atau tangguhkan" label="Hentikan atau tangguhkan">
				<p>
					Hentikan mematikan workload yang sedang melayani, pemilik tetap bisa men-deploy lagi.
					Tangguhkan juga melarang deploy sampai admin membuka penangguhannya.
				</p>
				<p>Semua aksi meminta alasan dan tercatat di audit.</p>
			</LearnMore>
		</PanelHelp>
	{/snippet}

	{#snippet danger()}
		<AdminDangerZone
			body={DANGER_CONTROLS_BODY}
			actions={dangerActions}
			note={notServing ? NOT_SERVING_NOTE : null}
		/>
	{/snippet}

	<FormPageLayout panelLabel={ADMIN_PANEL_COPY.label} {panel} after={danger}>
		{#if project.suspension}
			<div class="rounded-card border border-warning/30 bg-accent-soft p-4 text-sm" role="status">
				<p class="font-semibold text-foreground">
					Ditangguhkan sejak {formatWibDateTime(project.suspension.suspended_at)}
				</p>
				<p class="mt-1 wrap-anywhere text-foreground">
					Alasan: {project.suspension.reason ?? 'tidak tercatat'}
				</p>
			</div>
		{/if}

		<DescriptionList
			columns={2}
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

		<section aria-labelledby="control-history" class="flex flex-col gap-3">
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
							<td class="px-4 py-3 font-medium">{label(request.action)}</td>
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
	</FormPageLayout>

	<ProjectControls bind:this={controls} {project} />
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
