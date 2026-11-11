<script lang="ts">
	import type { Snippet } from 'svelte';
	import List from 'phosphor-svelte/lib/List';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AdminSidebar from './AdminSidebar.svelte';

	let { children }: { children: Snippet } = $props();

	let isMobileOpen = $state(false);
</script>

<!-- The admin area has its own navigation, apart from the student sidebar, so nothing of a
     member's project context (header project name, notifications) leaks into it. -->
<div class="flex h-dvh overflow-hidden bg-background lg:p-6">
	<AdminSidebar {isMobileOpen} onCloseMobile={() => (isMobileOpen = false)} />

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<main class="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:py-0 lg:pr-0 lg:pl-6">
			<div class="mb-4 flex items-center gap-2 lg:hidden">
				<Button
					id="admin-nav-toggle"
					variant="ghost"
					size="icon"
					class="-ml-2 text-foreground"
					onclick={() => (isMobileOpen = !isMobileOpen)}
					aria-label="Buka navigasi admin"
				>
					<List size={20} aria-hidden="true" />
				</Button>
				<SakalaLogo lockup="mark" class="size-7" />
				<span class="text-sm font-semibold text-foreground">Area admin</span>
			</div>
			<div id="main-content" tabindex="-1" class="mx-auto w-full max-w-page pb-10 outline-none">
				{@render children()}
			</div>
		</main>
	</div>
</div>
