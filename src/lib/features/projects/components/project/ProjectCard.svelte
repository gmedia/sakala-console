<script lang="ts">
	import GitBranch from 'phosphor-svelte/lib/GitBranch';
	import GitCommit from 'phosphor-svelte/lib/GitCommit';
	import { resolve } from '$app/paths';
	import type { Project } from '$lib/api/resources/projects';
	import BreakableUrl from '$lib/components/ui/BreakableUrl.svelte';
	import { formatDate, formatRelativeTime } from '$lib/utils/date';
	import {
		getFrameworkLabel,
		getProjectPublicUrl,
		getPublicUrlLabel,
		toRuntimeStatus
	} from '../../presentation';
	import RuntimeStatusBadge from './RuntimeStatusBadge.svelte';

	type Props = Project;

	let { ...project }: Props = $props();

	const framework = $derived(project.stack?.framework);
	const latest = $derived(project.latest_deployment);
	const publicUrl = $derived(getProjectPublicUrl(project));
	// A project that serves nothing has an address, and showing it as a link would promise a site.
	// A suspended one has its traffic cut even while the agent has not stopped it yet.
	const isLive = $derived(
		project.suspension == null && toRuntimeStatus(project.runtime_status) === 'running'
	);
	const lastActivityAt = $derived(latest?.created_at ?? project.last_deployed_at);
</script>

<!-- The whole card opens the project, through a link stretched over it. The URL sits above that. -->
<article
	class="surface-card relative flex min-w-0 flex-col gap-3 p-5 transition-colors hover:border-primary"
>
	<div class="min-w-0">
		<h2 class="min-w-0 font-sans text-base font-semibold text-foreground">
			<a
				href={resolve(`/projects/${project.id}`)}
				title={project.name}
				class="line-clamp-2 wrap-anywhere after:absolute after:inset-0 after:content-['']"
			>
				{project.name}
			</a>
		</h2>
		{#if isLive && publicUrl}
			<a
				href={publicUrl}
				target="_blank"
				rel="external noopener noreferrer"
				data-testid="project-card-url"
				class="relative z-10 mt-1 inline-block min-h-6 max-w-full font-mono text-sm leading-6 wrap-anywhere text-primary-dark underline underline-offset-2"
			>
				<BreakableUrl text={getPublicUrlLabel(publicUrl)} />
			</a>
		{:else if project.repository_full_name}
			<p class="mt-1 truncate font-mono text-sm text-muted" title={project.repository_full_name}>
				{project.repository_full_name}
			</p>
		{/if}
	</div>

	{#if latest?.commit_message}
		<p
			data-testid="project-card-commit"
			class="flex min-w-0 items-start gap-1.5 text-sm text-foreground"
			title={latest.commit_message}
		>
			<GitCommit size={16} class="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
			<span class="line-clamp-2 min-w-0 wrap-anywhere">{latest.commit_message}</span>
		</p>
	{/if}

	<!-- Always there, so cards with and without a framework line up. -->
	<div class="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
		<span class="inline-flex min-w-0 items-center gap-1">
			<GitBranch size={14} class="shrink-0" aria-hidden="true" />
			<span class="truncate">{latest?.branch ?? project.branch}</span>
		</span>
		{#if latest?.commit_sha}
			<span class="font-mono tabular-nums">{latest.commit_sha.substring(0, 7)}</span>
		{/if}
		{#if framework}
			<span data-testid="framework-chip" class="truncate font-medium text-foreground">
				{getFrameworkLabel(framework)}
			</span>
		{/if}
	</div>

	<div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
		<RuntimeStatusBadge runtimeStatus={project.runtime_status} suspension={project.suspension} />
		{#if lastActivityAt}
			<time
				datetime={lastActivityAt}
				title={formatDate(lastActivityAt)}
				class="whitespace-nowrap text-xs text-muted"
			>
				Deploy {formatRelativeTime(lastActivityAt).toLowerCase()}
			</time>
		{:else}
			<span class="whitespace-nowrap text-xs text-muted">Belum pernah deploy</span>
		{/if}
	</div>
</article>
