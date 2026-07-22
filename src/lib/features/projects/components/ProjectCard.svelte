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
			<p class="text-sm font-semibold">{project_name}</p>
		</div>
		<Badge tone={status} class="absolute top-6 right-4 ">{status}</Badge>
	</div>
	<p
		class="mt-0 mb-5 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-gray-400"
	>
		<span>{repository_name}</span>
	</p>
	<div class="h-40 w-full overflow-hidden rounded-xl border border-border bg-background-soft">
		{#if status === 'failed' || status === 'pending'}
			<div
				class="flex flex-col items-center justify-center gap-2 rounded-xl border border-border h-full p-4"
			>
				<p class="text-lg font-bold text-gray-400">{status_message}</p>
			</div>
		{:else}
			<img class="rounded-xl" src={thumbnail_url} alt="Project Thumbnail" />
		{/if}
	</div>
	<!-- <span
		class="size-3.5 flex items-center justify-center [&>svg]:size-full [&>svg]:fill-current text-gray-600"
	>
	</span> -->
	<div class="flex w-full justify-between items-center mt-4">
		<p class="mt-4 mb-2 text-sm text-muted">{created_at}</p>
		<Button variant="outline">Lihat detail</Button>
	</div>
</Card>
