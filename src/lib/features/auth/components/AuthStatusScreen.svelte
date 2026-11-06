<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { AuthStatusContent } from '../email-link-status';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SakalaLogo from '$lib/components/brand/SakalaLogo.svelte';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleHelp from '@lucide/svelte/icons/circle-help';

	type Props = AuthStatusContent & {
		children: Snippet;
	};

	let { tone, badge, title, description, children }: Props = $props();

	const Icon = $derived(
		tone === 'success' ? BadgeCheck : tone === 'error' ? CircleAlert : CircleHelp
	);
	const iconClass = $derived(
		tone === 'success' ? 'text-primary-600' : tone === 'error' ? 'text-error-base' : 'text-muted'
	);
</script>

<main
	id="main-content"
	tabindex="-1"
	class="outline-none flex min-h-screen flex-col items-center justify-center p-4 pb-24 sm:p-8"
>
	<SakalaLogo class="mb-8 h-9.25 w-40.5" />

	<div class="w-full max-w-2xl text-center">
		<Badge
			tone={tone === 'unknown' ? 'muted' : tone}
			label={badge}
			class="text-sm font-semibold [&>span:first-child]:hidden {tone === 'success'
				? 'border-primary bg-primary-50 text-primary'
				: ''}"
		>
			{badge}
		</Badge>

		<h1 class="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h1>

		<p class="mx-auto mt-2 max-w-xl text-sm leading-6 sm:text-base sm:leading-7">{description}</p>
	</div>

	<div class="mt-8 flex items-center justify-center">
		<Icon size={80} class={iconClass} aria-hidden="true" />
	</div>

	<div class="mt-8 w-full max-w-sm space-y-4">
		{@render children()}
	</div>
</main>
