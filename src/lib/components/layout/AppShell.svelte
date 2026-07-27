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

<div class="flex h-screen overflow-hidden bg-background">
	<Sidebar {isMobileOpen} onCloseMobile={() => (isMobileOpen = false)} />

	<div class="flex flex-1 flex-col overflow-hidden">
		<Header onToggleMobile={() => (isMobileOpen = !isMobileOpen)} />
		<main class="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
			<div class="mx-auto w-full max-w-7xl">
				{@render children()}
			</div>
		</main>
	</div>
</div>
