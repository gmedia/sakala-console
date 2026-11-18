<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		deriveDurationLabel,
		getDeploymentTriggerLabel
	} from '$lib/features/deployments/deployment-presentation';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import { createRecentDeploymentsQuery } from '../../queries';
	import { getDeploymentBadge } from '../../presentation';
	import type { Deployment } from '../../type';

	let { projectId }: { projectId: string } = $props();

	/** Five rows: a glance at what changed, with Riwayat one click away for the rest. */
	const SHOWN = 5;
	const riwayatPath = $derived(resolveRoute('/(app)/projects/[id]/deployments', { id: projectId }));
	const SHORT_SHA = 7;

	// The header reads the same list, so this costs no request of its own.
	const query = createRecentDeploymentsQuery(() => projectId);
	const deployments = $derived(
		[...(query.data?.data ?? [])].sort((a, b) => b.sequence - a.sequence).slice(0, SHOWN)
	);

	const COPY = {
		title: 'Deployment terbaru',
		link: 'Lihat semua riwayat',
		empty: 'Belum ada deployment. Deploy pertama muncul di sini begitu dijalankan.',
		error: 'Deployment terbaru belum bisa dimuat. Riwayatnya sendiri tidak hilang.',
		manual: 'Deployment manual'
	} as const;

	const message = (deployment: Deployment) => deployment.commit_message || COPY.manual;
	const shortSha = (deployment: Deployment) =>
		deployment.commit_sha ? deployment.commit_sha.substring(0, SHORT_SHA) : null;
	const duration = (deployment: Deployment) =>
		deriveDurationLabel(deployment.started_at, deployment.finished_at ?? deployment.cancelled_at);
	const detailHref = (deployment: Deployment) =>
		resolveRoute('/(app)/projects/[id]/deployments/[deploymentId]', {
			id: projectId,
			deploymentId: deployment.id
		});
</script>

<section
	aria-labelledby="overview-deployments-title"
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-6"
	data-testid="overview-deployments"
>
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<h2 id="overview-deployments-title" class="text-base text-foreground">{COPY.title}</h2>
		<a
			href={riwayatPath}
			class="inline-flex min-h-6 items-center text-sm font-medium text-primary-dark underline underline-offset-2"
		>
			{COPY.link}
		</a>
	</div>

	{#if query.isPending}
		<ul class="flex flex-col gap-3" role="status">
			<span class="sr-only">Memuat deployment terbaru...</span>
			{#each [1, 2, 3] as item (item)}
				<li class="flex items-center gap-3" aria-hidden="true">
					<div class="skeleton h-4 flex-1"></div>
					<div class="skeleton h-4 w-20"></div>
				</li>
			{/each}
		</ul>
	{:else if query.isError}
		<div role="alert" class="flex flex-wrap items-center gap-3 text-error">
			<WarningCircle size={20} weight="fill" aria-hidden="true" />
			<p class="min-w-0 flex-1 text-sm font-medium">{COPY.error}</p>
			<Button
				variant="secondary"
				size="sm"
				onclick={() => query.refetch()}
				disabled={query.isFetching}
			>
				{query.isFetching ? 'Memuat...' : 'Coba lagi'}
			</Button>
		</div>
	{:else if deployments.length === 0}
		<p class="text-sm text-muted">{COPY.empty}</p>
	{:else}
		<!--
			A real table. Below 40rem of card the trigger and time move under the commit, so two columns
			fit a phone; the hidden cells leave the accessibility tree with their headers.
		-->
		<div class="@container -mx-4 sm:-mx-6">
			<table class="w-full table-fixed border-collapse text-left text-sm">
				<thead class="text-xs text-muted">
					<tr class="border-b border-border">
						<th scope="col" class="px-4 py-2 font-medium sm:pl-6">Commit</th>
						<th scope="col" class="w-28 px-4 py-2 font-medium sm:pr-6 @xl:w-36 @xl:pr-4">Status</th>
						<th scope="col" class="hidden w-40 px-4 py-2 font-medium @xl:table-cell">Pemicu</th>
						<th scope="col" class="hidden w-36 px-4 py-2 font-medium sm:pr-6 @xl:table-cell"
							>Waktu</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each deployments as deployment (deployment.id)}
						{@const badge = getDeploymentBadge(deployment.status)}
						{@const time = duration(deployment)}
						<tr data-testid="overview-deployment-row">
							<td class="px-4 py-2.5 align-top sm:pl-6">
								<a
									href={detailHref(deployment)}
									class="block min-h-6 truncate leading-6 font-medium text-foreground underline-offset-2 hover:underline"
									title={message(deployment)}
								>
									{message(deployment)}
								</a>
								<span class="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
									<span class="font-mono tabular-nums">#{deployment.sequence}</span>
									{#if shortSha(deployment)}
										<span class="font-mono tabular-nums">{shortSha(deployment)}</span>
									{/if}
									<span class="@xl:hidden">{getDeploymentTriggerLabel(deployment.trigger)}</span>
									{#if deployment.created_at}
										<time
											class="@xl:hidden"
											datetime={deployment.created_at}
											title={formatDate(deployment.created_at)}
											>{formatRelativeTime(deployment.created_at)}</time
										>
									{/if}
								</span>
							</td>
							<td class="px-4 py-2.5 align-top sm:pr-6 @xl:pr-4">
								<Badge tone={badge.variant}>{badge.label}</Badge>
								{#if time}
									<span class="mt-0.5 block text-xs text-muted tabular-nums">{time}</span>
								{/if}
							</td>
							<td class="hidden px-4 py-2.5 align-top text-foreground @xl:table-cell">
								{getDeploymentTriggerLabel(deployment.trigger)}
							</td>
							<td
								class="hidden px-4 py-2.5 align-top whitespace-nowrap text-foreground sm:pr-6 @xl:table-cell"
							>
								{#if deployment.created_at}
									<time datetime={deployment.created_at} title={formatDate(deployment.created_at)}
										>{formatRelativeTime(deployment.created_at)}</time
									>
								{:else}
									-
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
