<script lang="ts">
	import type { Snippet } from 'svelte';
	import Sidebar from './Sidebar.svelte';
	import Header from './Header.svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();

	let isMobileOpen = $state(false);
</script>

<div class="flex h-dvh overflow-hidden bg-background lg:p-6">
	<Sidebar {isMobileOpen} onCloseMobile={() => (isMobileOpen = false)} />

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<main class="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:py-0 lg:pl-6 lg:pr-0">
			<Header onToggleMobile={() => (isMobileOpen = !isMobileOpen)} />
			<div id="main-content" tabindex="-1" class="mx-auto w-full max-w-page outline-none">
				{@render children()}
			</div>
		</main>
	</div>
</div>
