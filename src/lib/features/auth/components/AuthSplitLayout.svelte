<script lang="ts">
	import type { Snippet } from 'svelte';
	import AuthBranding from './AuthBranding.svelte';

	type Props = {
		title: string;
		description: string;
		children: Snippet;
	};

	let { title, description, children }: Props = $props();
</script>

<main
	id="main-content"
	tabindex="-1"
	class="min-h-screen grid grid-cols-1 lg:grid-cols-10 outline-none"
>
	<div class="flex flex-col justify-center items-center bg-white p-8 sm:p-12 lg:p-16 lg:col-span-4">
		<div class="w-full max-w-lg space-y-8">
			<div class="space-y-2">
				<h1 class="text-4xl font-semibold text-zinc-950 tracking-tight">{title}</h1>
				<p class="text-sm text-muted font-normal">{description}</p>
			</div>
			{@render children()}
		</div>
	</div>
	<AuthBranding mode="login" />
</main>
