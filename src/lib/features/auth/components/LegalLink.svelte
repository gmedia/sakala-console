<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A new tab, so a form half filled in stays as it is. */
	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- a page on the landing site -->
<a
	{href}
	target="_blank"
	rel="noopener noreferrer"
	class="font-medium text-primary-dark underline underline-offset-2"
>
	{@render children()}
</a>
<!-- eslint-enable svelte/no-navigation-without-resolve -->
