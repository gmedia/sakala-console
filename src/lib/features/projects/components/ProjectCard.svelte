<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatDate } from '$lib/utils/date';

	import type { Project, runtime_status } from '$lib/features/projects/type';

	type badgeConfig = {
		variant: 'neutral' | 'success' | 'error' | 'warning' | 'info' | 'muted';
		label: string;
	};

	const runtimeStatusBadge: Record<runtime_status, badgeConfig> = {
		running: { variant: 'success', label: 'Live' },
		failed: { variant: 'error', label: 'Failed' },
		stopped: { variant: 'error', label: 'Failed' },
		crashed: { variant: 'error', label: 'Failed' },
		deploying: { variant: 'warning', label: 'Deploying' },
		not_deployed: { variant: 'muted', label: 'Belum Deploy' }
	};

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
			case 'stopped':
			case 'crashed':
				return {
					type: 'placeholder',
					text: '404'
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

	type Props = Project & {
		loading?: boolean;
	};

	let { ...projects }: Props = $props();
	const badge = $derived(runtimeStatusBadge[projects.runtime_status]);
</script>

<Card
	class="relative rounded-xl border border-muted/30 hover:text-primary hover:shadow-lg transition-all duration-300"
>
	<div class="flex items-center justify-between gap-2">
		<p class="flex-1 truncate text-lg font-montserrat-semibold" title={projects.project_name}>
			{projects.project_name}
		</p>
		<Badge tone={badge.variant} class="shrink-0 tracking-wide">{badge.label}</Badge>
	</div>
	<p
		class="mb-5 text-sm truncate font-jetbrains-mono-regular text-muted"
		title={projects.repository_full_name}
	>
		<span>{projects.repository_full_name}</span>
	</p>
	<div class="h-40 w-full overflow-hidden rounded-xl bg-background-soft">
		{#if thumbnailState.type === 'image'}
			<img
				class="h-full w-full object-cover"
				src={thumbnailState.src}
				alt={projects.project_name}
			/>
		{:else}
			<div class="flex flex-col items-center justify-center gap-2 rounded-xl h-full p-4">
				<p class="text-md font-montserrat-semibold text-muted">{thumbnailState.text}</p>
			</div>
		{/if}
	</div>
	<div class="flex w-full justify-between items-center mt-4">
		<p class="mt-4 mb-2 text-sm text-muted/80 font-jetbrains-mono-medium">
			{formatDate(projects.created_at)}
		</p>
		<Button variant="outline" class="hover:cursor-pointer font-montserrat-semibold"
			>Lihat detail</Button
		>
	</div>
</Card>
