<script lang="ts">
	import { Bell, Menu } from '@lucide/svelte';
	import { page } from '$app/state';

	type Props = {
		onToggleMobile?: () => void;
		hasUnread?: boolean;
		unreadCount?: number;
	};

	let { onToggleMobile, hasUnread = false, unreadCount = 0 }: Props = $props();

	const pageTitle = $derived(page.url.pathname.startsWith('/projects') ? 'User Guide' : 'Projects');
</script>

<header
	class="sticky top-0 z-40 flex h-16 items-center border-b border-border bg-surface px-4 backdrop-blur-xl sm:px-6 lg:px-8"
>
	<button
		type="button"
		class="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-background-soft hover:text-foreground md:hidden"
		onclick={onToggleMobile}
		aria-label="Buka navigasi"
	>
		<Menu size={20} />
	</button>

	<h1 class="text-base font-medium text-foreground">
		{pageTitle}
	</h1>

	<div class="ml-auto flex items-center gap-4">
		<button
			type="button"
			class="relative flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary transition-colors hover:bg-primary-100"
			aria-label="Buka notifikasi"
		>
			<Bell size={20} class="text-primary" />
			{#if hasUnread || unreadCount > 0}
				<span
					class="absolute top-2.5 right-2.5 size-2 rounded-full bg-error ring-2 ring-surface"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	</div>
</header>
