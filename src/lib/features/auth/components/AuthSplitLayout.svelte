<script lang="ts">
	import type { Snippet } from 'svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import AuthBranding from './AuthBranding.svelte';

	type Props = {
		title: string;
		description?: string;
		mode?: 'login' | 'register';
		children: Snippet;
	};

	let { title, description, mode = 'login', children }: Props = $props();
</script>

<main
	id="main-content"
	tabindex="-1"
	class="grid min-h-screen grid-cols-1 outline-none lg:grid-cols-10"
>
	<div
		class="flex flex-col items-center justify-center bg-surface p-6 sm:p-12 lg:col-span-4 lg:p-16"
	>
		<div class="w-full max-w-md space-y-8">
			<SakalaLogo class="h-10 lg:hidden" />
			<div class="space-y-2">
				<h1 class="text-3xl text-foreground">{title}</h1>
				{#if description}
					<p class="text-sm text-muted">{description}</p>
				{/if}
			</div>
			{@render children()}
		</div>
	</div>
	<AuthBranding {mode} />
</main>
