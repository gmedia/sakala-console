<script lang="ts">
	import List from 'phosphor-svelte/lib/List';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { useCurrentUser } from '$lib/features/auth/queries';
	import { createUnreadNotificationCountQuery } from '$lib/features/notifications/queries';
	import { useNotificationsLive } from '$lib/features/notifications/use-notifications-live.svelte';
	import NotificationPopover from '$lib/features/notifications/components/NotificationPopover.svelte';
	import { createProjectQuery } from '$lib/features/projects/queries';
	import ProjectAvatar from '$lib/features/projects/components/project/ProjectAvatar.svelte';
	import { useDatabaseRoute } from '$lib/features/databases/route-state.svelte';
	import { useBucketRoute } from '$lib/features/buckets/route-state.svelte';
	import { useValkeyRoute } from '$lib/features/valkeys/route-state.svelte';

	type Props = {
		onToggleMobile?: () => void;
	};

	let { onToggleMobile }: Props = $props();

	const currentUser = useCurrentUser();
	const unreadCountQuery = createUnreadNotificationCountQuery();

	useNotificationsLive(() => currentUser.data?.id ?? null);

	const projectQuery = createProjectQuery(() => page.params.id ?? '');
	const currentProject = $derived(page.params.id ? projectQuery.data : null);
	const projectName = $derived(currentProject?.name ?? currentProject?.project_name ?? '');

	// A database page names its database after "Database /", like a project page does.
	const databaseRoute = useDatabaseRoute();
	const bucketRoute = useBucketRoute();
	const valkeyRoute = useValkeyRoute();

	// The one page heading. Pages below it do not repeat it.
	const pageTitle = $derived.by(() => {
		const path = page.url.pathname;
		if (path.startsWith('/notifications')) return 'Notifikasi';
		if (path.startsWith('/settings')) return 'Pengaturan';
		if (path.startsWith('/feedback')) return 'Kirim masukan';
		if (path.startsWith('/projects/new')) return 'Proyek baru';
		if (path.startsWith('/workspace-invitations')) return 'Undangan workspace';
		if (path.startsWith('/workspaces')) return 'Workspace';
		if (path.startsWith('/databases')) return 'Database';
		if (path.startsWith('/buckets')) return 'Bucket';
		if (path.startsWith('/valkeys')) return 'Valkey';
		return 'Proyek';
	});
</script>

<header class="mb-6 lg:mb-8">
	<div class="mx-auto flex w-full max-w-page items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2 lg:gap-3">
			<Button
				id="mobile-nav-toggle"
				variant="ghost"
				size="icon"
				class="-ml-2 text-foreground lg:hidden"
				onclick={onToggleMobile}
				aria-label="Buka navigasi"
			>
				<List size={20} aria-hidden="true" />
			</Button>
			<SakalaLogo lockup="mark" class="size-7 lg:hidden" />

			<h1 class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-base sm:text-xl">
				{#if page.params.id}
					<a href={resolve('/projects')} class="font-medium text-muted hover:text-foreground">
						Proyek
					</a>
					<span class="font-medium text-muted" aria-hidden="true">/</span>
					<span class="flex min-w-0 items-center gap-2">
						{#if currentProject}
							<!-- Below 640 px the name needs the room more than the tile does; the card still shows it. -->
							<ProjectAvatar
								size="sm"
								class="max-sm:hidden"
								project={{
									id: currentProject.id,
									name: projectName,
									slug: currentProject.slug,
									public_url: currentProject.public_url,
									thumbnail_url: currentProject.thumbnail_url
								}}
							/>
						{/if}
						<a
							href={resolve(`/projects/${page.params.id}`)}
							class="line-clamp-2 min-w-0 wrap-anywhere text-foreground"
							title={projectName}>{projectName || '...'}</a
						>
					</span>
				{:else if databaseRoute.databaseId}
					<a href={resolve('/databases')} class="font-medium text-muted hover:text-foreground">
						Database
					</a>
					<span class="font-medium text-muted" aria-hidden="true">/</span>
					<span class="line-clamp-2 min-w-0 font-mono wrap-anywhere text-foreground"
						>{databaseRoute.name ?? '...'}</span
					>
				{:else if bucketRoute.bucketId}
					<a href={resolve('/buckets')} class="font-medium text-muted hover:text-foreground">
						Bucket
					</a>
					<span class="font-medium text-muted" aria-hidden="true">/</span>
					<span class="line-clamp-2 min-w-0 font-mono wrap-anywhere text-foreground"
						>{bucketRoute.name ?? '...'}</span
					>
				{:else if valkeyRoute.valkeyId && valkeyRoute.valkeyId !== 'new'}
					<a href={resolve('/valkeys')} class="font-medium text-muted hover:text-foreground">
						Valkey
					</a>
					<span class="font-medium text-muted" aria-hidden="true">/</span>
					<span class="line-clamp-2 min-w-0 font-mono wrap-anywhere text-foreground"
						>{valkeyRoute.name ?? '...'}</span
					>
				{:else}
					<span class="text-foreground">{pageTitle}</span>
				{/if}
			</h1>
		</div>

		<NotificationPopover unreadCount={unreadCountQuery.data ?? 0} />
	</div>
</header>
