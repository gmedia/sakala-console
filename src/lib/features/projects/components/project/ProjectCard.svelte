<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import { formatDate } from '$lib/utils/date';
	import type { Project } from '$lib/api/resources/projects';
	import { resolve } from '$app/paths';
	import RuntimeStatusBadge from './RuntimeStatusBadge.svelte';

	const thumbnailState = $derived.by(() => {
		if (projects.thumbnail_url) {
			return {
				type: 'image',
				src: projects.thumbnail_url
			} as const;
		}

		switch (projects.runtime_status) {
			case 'deploying':
				return {
					type: 'placeholder',
					text: 'Menunggu build selesai...'
				} as const;

			case 'failed':
				return {
					type: 'placeholder',
					text: 'Deployment gagal'
				} as const;

			case 'crashed':
				return {
					type: 'placeholder',
					text: 'Project mengalami crash'
				} as const;

			case 'stopped':
				return {
					type: 'placeholder',
					text: 'Project sedang berhenti'
				} as const;

			case 'not_deployed':
				return {
					type: 'placeholder',
					text: 'Belum Deploy'
				} as const;

			default:
				return {
					type: 'placeholder',
					text: 'Belum memiliki thumbnail'
				} as const;
		}
	});

	type Props = Project;

	let { ...projects }: Props = $props();
</script>

<Card
	class="relative rounded-xl border border-muted/30 hover:text-primary hover:shadow-lg transition-all duration-300"
>
	<div class="flex items-center justify-between gap-2">
		<p class="flex-1 min-w-0 truncate text-lg font-montserrat-semibold" title={projects.name}>
			{projects.name}
		</p>
		<RuntimeStatusBadge runtimeStatus={projects.runtime_status} />
	</div>
	<p
		class="mb-5 text-sm truncate font-jetbrains-mono-regular text-muted"
		title={projects.repository_full_name}
	>
		<span>{projects.repository_full_name}</span>
	</p>
	<div class="h-40 w-full overflow-hidden rounded-xl bg-background-soft">
		{#if thumbnailState.type === 'image'}
			<img class="h-full w-full object-cover" src={thumbnailState.src} alt={projects.name} />
		{:else}
			<div class="flex flex-col items-center justify-center gap-2 rounded-xl h-full p-4">
				<p data-testid="thumbnail-placeholder" class="text-md font-montserrat-semibold text-muted">
					{thumbnailState.text}
				</p>
			</div>
		{/if}
	</div>
	<div class="mt-4 flex w-full items-center justify-between gap-3">
		<p class="mt-4 mb-2 min-w-0 truncate text-sm text-muted/80 font-jetbrains-mono-medium">
			{projects.last_deployed_at ? formatDate(projects.last_deployed_at) : 'Belum pernah deploy'}
		</p>

		<a
			href={resolve(`/projects/${projects.id}`)}
			class="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-muted/30 px-4 py-2 font-montserrat-semibold text-sm transition-colors hover:cursor-pointer hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
		>
			Lihat detail
		</a>
	</div>
</Card>
