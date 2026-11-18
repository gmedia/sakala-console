<script lang="ts">
	import Cube from 'phosphor-svelte/lib/Cube';
	import { cn } from '$lib/utils/cn';
	import {
		getProjectAvatarTone,
		getProjectInitials,
		getProjectThumbnailUrl,
		type ProjectAvatarSource
	} from '../../project-avatar';

	type ProjectAvatarSize = 'sm' | 'md';

	type Props = {
		project: ProjectAvatarSource;
		/** `sm` sits beside the page heading, `md` beside a card's name. */
		size?: ProjectAvatarSize;
		class?: string;
	};

	let { project, size = 'md', class: className = '' }: Props = $props();

	/** Fixed boxes, so a thumbnail that loads late or fails moves nothing around it. */
	const sizes: Record<ProjectAvatarSize, { box: string; pixels: number; icon: number }> = {
		sm: { box: 'size-7 text-sm', pixels: 28, icon: 16 },
		md: { box: 'size-10 text-base', pixels: 40, icon: 20 }
	};

	const thumbnailUrl = $derived(getProjectThumbnailUrl(project));
	const initials = $derived(getProjectInitials(project));
	const tone = $derived(getProjectAvatarTone(project.id));

	// The address that failed, so a new thumbnail URL gets its own try.
	let failedUrl = $state<string | null>(null);
	const shownThumbnailUrl = $derived(thumbnailUrl === failedUrl ? null : thumbnailUrl);
</script>

<!-- Decorative: the project's name is always next to it, so it adds no tab stop and no name. -->
{#if shownThumbnailUrl}
	<img
		src={shownThumbnailUrl}
		alt=""
		loading="lazy"
		decoding="async"
		referrerpolicy="no-referrer"
		width={sizes[size].pixels}
		height={sizes[size].pixels}
		data-testid="project-avatar-thumbnail"
		class={cn(
			'shrink-0 rounded-control border border-border bg-surface object-cover',
			sizes[size].box,
			className
		)}
		onerror={() => (failedUrl = shownThumbnailUrl)}
	/>
{:else}
	<span
		aria-hidden="true"
		data-testid="project-avatar"
		data-tone={tone}
		class={cn(
			'inline-flex shrink-0 items-center justify-center rounded-control leading-none font-semibold text-white select-none',
			sizes[size].box,
			tone,
			className
		)}
	>
		{#if initials}
			{initials}
		{:else}
			<Cube size={sizes[size].icon} weight="bold" data-testid="project-avatar-icon" />
		{/if}
	</span>
{/if}
