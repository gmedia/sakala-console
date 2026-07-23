<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	import type { Project } from '$lib/features/projects/type';

	type Props = Omit<Project, 'id'> & {
		loading?: boolean;
	};

	let { loading = false, ...project }: Props = $props();
</script>

<Card class="relative rounded-xl border border-muted/30">
	{#if loading}
		<div class="flex items-center justify-between gap-2">
			<div class="h-6 w-2/3 animate-pulse rounded-md bg-background-soft"></div>
			<div class="h-5 w-16 shrink-0 animate-pulse rounded-full bg-background-soft"></div>
		</div>
		<div class="mb-5 mt-2 h-4 w-1/3 animate-pulse rounded-md bg-background-soft"></div>
		<div class="h-40 w-full animate-pulse rounded-xl bg-background-soft"></div>
		<div class="flex w-full items-center justify-between mt-4">
			<div class="mt-4 mb-2 h-4 w-24 animate-pulse rounded-md bg-background-soft"></div>
			<div class="h-9 w-24 animate-pulse rounded-md bg-background-soft"></div>
		</div>
	{:else}
		<div class="flex items-center justify-between gap-2">
			<p class="flex-1 truncate text-lg font-montserrat-semibold" title={project.project_name}>
				{project.project_name}
			</p>
			<Badge tone={project.status} class="shrink-0 tracking-wide">{project.status}</Badge>
		</div>
		<p class="mb-5 text-sm font-jetbrains-mono-regular text-muted">
			<span>{project.repository_name}</span>
		</p>
		<div class="h-40 w-full overflow-hidden rounded-xl bg-background-soft">
			{#if project.status === 'failed' || project.status === 'pending'}
				<div class="flex flex-col items-center justify-center gap-2 rounded-xl h-full p-4">
					<p class="text-md font-montserrat-semibold text-muted">{project.status_message}</p>
				</div>
			{:else}
				<img
					class="h-full w-full object-cover"
					src={project.thumbnail_url}
					alt={project.project_name}
				/>
			{/if}
		</div>
		<div class="flex w-full justify-between items-center mt-4">
			<p class="mt-4 mb-2 text-sm text-muted/80 font-jetbrains-mono-medium">{project.created_at}</p>
			<Button variant="outline" class="hover:cursor-pointer font-montserrat-semibold"
				>Lihat detail</Button
			>
		</div>
	{/if}
</Card>
