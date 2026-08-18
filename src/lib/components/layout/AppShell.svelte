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

<div class="flex h-screen overflow-hidden bg-background p-6">
	<Sidebar {isMobileOpen} onCloseMobile={() => (isMobileOpen = false)} />

	<div class="flex flex-1 flex-col overflow-hidden">
		<main class="flex-1 overflow-y-auto px-6 py-6">
			<Header onToggleMobile={() => (isMobileOpen = !isMobileOpen)} />
			<div class="mx-auto w-full max-w-7xl">
				{@render children()}
			</div>
		</main>
	</div>
</div>
