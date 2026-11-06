<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import { resolveRoute } from '$app/paths';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Link from 'phosphor-svelte/lib/Link';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { ResolvedPathname } from '$app/types';
	import type { ProjectHeaderNotice } from '../../presentation';

	let { projectId, notice }: { projectId: string; notice: ProjectHeaderNotice } = $props();

	const deploymentRoute = '/(app)/projects/[id]/deployments/[deploymentId]';
	const historyHref = $derived(
		resolveRoute('/(app)/projects/[id]/deployments', { id: projectId }) as ResolvedPathname
	);
	const link = $derived.by(() => {
		const target = notice.link;
		if (!target) return null;
		const path = resolveRoute(deploymentRoute, {
			id: projectId,
			deploymentId: target.deploymentId
		});
		return {
			label: target.label,
			href: (target.toLogs ? `${path}#deployment-logs` : path) as ResolvedPathname
		};
	});
</script>

<div
	role="status"
	class="flex flex-col justify-between gap-3 rounded-control border border-border bg-surface px-4 py-3 text-foreground md:flex-row md:items-center"
>
	<div class="flex min-w-0 items-start gap-2 md:items-center">
		{#if notice.tone === 'info'}
			<CircleNotch
				size={24}
				weight="bold"
				class="shrink-0 animate-spin text-primary motion-reduce:animate-none"
			/>
		{:else if notice.tone === 'error'}
			<WarningCircle size={24} class="shrink-0 text-error" />
		{:else if notice.tone === 'warning'}
			<WarningCircle size={24} class="shrink-0 text-warning-dark" />
		{:else}
			<Link size={24} class="shrink-0 text-foreground" />
		{/if}
		<span class="min-w-0 text-sm wrap-anywhere">{notice.message}</span>
	</div>

	{#if link}
		<Button variant="secondary" size="sm" class="shrink-0 whitespace-nowrap" href={link.href}>
			{link.label}
		</Button>
	{:else if notice.tone === 'error'}
		<Button variant="secondary" size="sm" class="shrink-0 whitespace-nowrap" href={historyHref}>
			Lihat riwayat
		</Button>
	{/if}
</div>
