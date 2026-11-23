<script lang="ts">
	// The guide is a page on the landing site, outside this app's routes.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import { FILE_STORAGE_COPY } from '../../file-storage';

	/** "Panduan penyimpanan file", opening the guide (or one of its sections) in a new tab. */
	let { href }: { href: string } = $props();
</script>

<a
	{href}
	target="_blank"
	rel="noreferrer noopener"
	class="inline-flex min-h-6 items-center gap-1 self-start font-medium text-primary-dark underline underline-offset-2"
	data-testid="file-storage-guide"
>
	{FILE_STORAGE_COPY.guideLink}
	<ArrowSquareOut size={14} aria-hidden="true" />
	<span class="sr-only">(tab baru)</span>
</a>
