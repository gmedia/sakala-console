<script lang="ts">
	import type { Project } from '$lib/features/projects/type';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { ArrowSquareOut, ArrowsClockwise, Copy, Link } from 'phosphor-svelte';

	type Props = {
		project: Project;
	};

	let { project }: Props = $props();

	let badgeTone = $derived.by<'success' | 'error' | 'warning' | 'info' | 'neutral'>(() => {
		if (project.status !== 'ready') {
			if (project.status === 'failed') return 'error';
			return 'warning';
		}

		switch (project.runtime_status) {
			case 'running':
				return 'success';
			case 'failed':
			case 'crashed':
				return 'error';
			case 'deploying':
				return 'info';
			default:
				return 'neutral';
		}
	});

	let displayStatus = $derived(
		project.status === 'ready' ? project.runtime_status.replace('_', ' ') : project.status
	);
</script>

<div class="flex flex-col gap-8 mb-8">
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div class="flex flex-col gap-1.5">
			<div class="flex items-center gap-3">
				<h1 class="text-[22px] font-sans font-semibold tracking-tight text-foreground leading-none">
					{project.project_name}
				</h1>
				<Badge tone={badgeTone} class="capitalize px-2 py-0.5">{displayStatus}</Badge>
			</div>
			<div class="flex items-center gap-2 text-sm text-muted font-medium mt-1 font-mono">
				<span>{project.repository_full_name || 'Repository'}</span>
				<span>&bull;</span>
				<span>{project.branch || 'main'}</span>
			</div>
		</div>

		<div class="flex items-center">
			<button
				class="flex items-center gap-2 bg-[#187768] hover:bg-[#187768]/90 text-white h-10 px-4 rounded-lg font-medium transition-colors shadow-sm text-sm"
			>
				<ArrowsClockwise size={18} weight="bold" />
				Redeploy
			</button>
		</div>
	</div>

	<div
		class="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2.5 px-4 bg-[#F8FAFC] rounded-lg border border-border/80"
	>
		<div class="flex items-center gap-2.5">
			<Link size={20} class="text-[#187768]" weight="bold" />
			<span class="text-[#187768] font-semibold text-sm tracking-wide font-mono">
				{project.default_domain}
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
			<div class="flex items-center gap-1.5">
				<span>Framework</span>
				<span class="text-foreground font-semibold">Node.js</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span>Port</span>
				<span class="text-foreground font-semibold">{project.detected_port || '3000'}</span>
			</div>
			<div class="flex items-center gap-1.5">
				<span>Deploy terakhir</span>
				<span class="text-foreground font-semibold">2 jam lalu</span>
			</div>

			<div class="flex items-center gap-2 md:ml-4">
				<button
					class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm"
					aria-label="Copy URL"
				>
					<Copy size={16} />
				</button>
				<a
					href="https://{project.default_domain}"
					target="_blank"
					rel="noreferrer"
					class="flex items-center justify-center size-8 rounded-md border border-border/80 bg-white text-muted hover:text-foreground transition-colors shadow-sm"
					aria-label="Open external link"
				>
					<ArrowSquareOut size={16} />
				</a>
			</div>
		</div>
	</div>
</div>
