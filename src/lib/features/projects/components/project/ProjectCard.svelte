<script lang="ts">
	import GitBranch from 'phosphor-svelte/lib/GitBranch';
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/api/resources/projects';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import { getFrameworkLabel } from '../../presentation';
	import RuntimeStatusBadge from './RuntimeStatusBadge.svelte';

	type Props = Project;

	let { ...project }: Props = $props();

	const framework = $derived(project.stack?.framework);
</script>

<!--
	The whole card opens the project, through a link that stretches over it. A second link, such as
	the public URL once the list API sends it, can sit above that one with `relative z-10`.
-->
<article
	class="surface-card relative flex min-w-0 flex-col gap-3 p-5 transition-colors hover:border-primary"
>
	<div class="min-w-0">
		<h2 class="font-sans min-w-0 text-base font-semibold text-foreground">
			<a
				href={resolve(`/projects/${project.id}`)}
				title={project.name}
				class="line-clamp-2 wrap-anywhere after:absolute after:inset-0 after:content-['']"
			>
				{project.name}
			</a>
		</h2>
		{#if project.repository_full_name}
			<p class="mt-1 truncate font-mono text-sm text-muted" title={project.repository_full_name}>
				{project.repository_full_name}
			</p>
		{/if}
	</div>

	<!-- Always there, so cards with and without a framework line up. -->
	<div class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
		<span class="inline-flex min-w-0 items-center gap-1">
			<GitBranch size={14} class="shrink-0" aria-hidden="true" />
			<span class="truncate">{project.branch}</span>
		</span>
		{#if framework}
			<span data-testid="framework-chip" class="truncate font-medium text-foreground">
				{getFrameworkLabel(framework)}
			</span>
		{/if}
	</div>

	<div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
		<RuntimeStatusBadge runtimeStatus={project.runtime_status} />
		{#if project.last_deployed_at}
			<time
				datetime={project.last_deployed_at}
				title={formatDate(project.last_deployed_at)}
				class="whitespace-nowrap text-xs text-muted"
			>
				Deploy {formatRelativeTime(project.last_deployed_at).toLowerCase()}
			</time>
		{:else}
			<span class="whitespace-nowrap text-xs text-muted">Belum pernah deploy</span>
		{/if}
	</div>
</article>
