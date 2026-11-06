<script lang="ts">
	import { resolveRoute } from '$app/paths';
	import CircleNotch from 'phosphor-svelte/lib/CircleNotch';
	import Link from 'phosphor-svelte/lib/Link';
	import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
	import type { ProjectHeaderNotice } from '../../presentation';

	let { projectId, notice }: { projectId: string; notice: ProjectHeaderNotice } = $props();

	const deploymentRoute = '/(app)/projects/[id]/deployments/[deploymentId]';
	const historyHref = $derived(resolveRoute('/(app)/projects/[id]/deployments', { id: projectId }));
	const link = $derived.by(() => {
		const target = notice.link;
		if (!target) return null;
		const path = resolveRoute(deploymentRoute, {
			id: projectId,
			deploymentId: target.deploymentId
		});
		return { label: target.label, href: target.toLogs ? `${path}#deployment-logs` : path };
	});
</script>

<div
	role="status"
	class="flex flex-col justify-between gap-3 rounded-lg border border-border/80 bg-white px-4 py-3 text-foreground md:flex-row md:items-center"
>
	<div class="flex min-w-0 items-start gap-2 md:items-center">
		{#if notice.tone === 'info'}
			<CircleNotch
				size={24}
				weight="bold"
				class="shrink-0 animate-spin text-warning-dark motion-reduce:animate-none"
			/>
		{:else if notice.tone === 'error'}
			<WarningCircle size={24} class="shrink-0 text-error" />
		{:else if notice.tone === 'warning'}
			<WarningCircle size={24} class="shrink-0 text-warning-dark" />
		{:else}
			<Link size={24} class="shrink-0 text-foreground" />
		{/if}
		<span class="min-w-0 font-montserrat text-sm wrap-anywhere">{notice.message}</span>
	</div>

	<!-- Both come from resolveRoute above, plus a hash the rule cannot see through. -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#if link}
		<a
			href={link.href}
			class="flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white px-3 font-montserrat-semibold text-xs whitespace-nowrap text-foreground transition-colors hover:bg-muted/10"
		>
			{link.label}
		</a>
	{:else if notice.tone === 'error'}
		<a
			href={historyHref}
			class="flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white px-3 font-montserrat-semibold text-xs whitespace-nowrap text-foreground transition-colors hover:bg-muted/10"
		>
			Lihat riwayat
		</a>
	{/if}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</div>
