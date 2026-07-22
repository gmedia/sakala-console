<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';

	import type { Project } from '$lib/types/project';

	type Props = Omit<Project, 'id'>;

	let { project_name, repository_name, created_at, status, thumbnail_url, status_message }: Props =
		$props();
</script>

<Card class="relative rounded-xl">
	<div class="flex items-center justify-between">
		<div class="flex-1">
			<p class="text-lg font-montserrat">{project_name}</p>
		</div>
		<Badge tone={status} class="absolute top-6 right-6 ">{status}</Badge>
	</div>
	<p class="mb-5 text-sm font-jetbrains-mono-regular text-muted">
		<span>{repository_name}</span>
	</p>
	<div class="h-40 w-full overflow-hidden rounded-xl bg-background-soft">
		{#if status === 'failed' || status === 'pending'}
			<div class="flex flex-col items-center justify-center gap-2 rounded-xl h-full p-4">
				<p class="text-md font-montserrat text-muted">{status_message}</p>
			</div>
		{:else}
			<img class="h-full w-full object-cover" src={thumbnail_url} alt={project_name} />
		{/if}
	</div>
	<div class="flex w-full justify-between items-center mt-4">
		<p class="mt-4 mb-2 text-sm text-muted/80 font-jetbrains-mono-medium">{created_at}</p>
		<Button variant="outline" class="hover:cursor-pointer font-montserrat">Lihat detail</Button>
	</div>
</Card>
