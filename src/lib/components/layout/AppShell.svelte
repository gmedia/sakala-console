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

<div class="flex h-screen overflow-hidden bg-background p-2 md:p-6">
	<Sidebar {isMobileOpen} onCloseMobile={() => (isMobileOpen = false)} />

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
		<main class="flex-1 overflow-y-auto px-2 py-4 md:px-6 md:py-6">
			<Header onToggleMobile={() => (isMobileOpen = !isMobileOpen)} />
			<div id="main-content" tabindex="-1" class="mx-auto w-full max-w-7xl outline-none">
				{@render children()}
			</div>
		</main>
	</div>
</div>
