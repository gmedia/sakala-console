<script lang="ts">
	// The guide is a page on the landing site, outside this app's routes.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import TerminalWindow from 'phosphor-svelte/lib/TerminalWindow';
	import {
		LARAVEL_RELEASE_COMMAND,
		RELEASE_COMMAND_DOCS_URL
	} from '$lib/features/projects/build-help';
	import { DATABASE_COPY } from '../presentation';
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="database-release-title"
	data-testid="database-release-hint"
>
	<h2 id="database-release-title" class="flex items-center gap-2 text-base text-foreground">
		<TerminalWindow size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
		{DATABASE_COPY.releaseTitle}
	</h2>
	<p class="text-sm text-muted">{DATABASE_COPY.releaseBody}</p>
	<p class="flex flex-col gap-1 text-sm text-foreground">
		<span>Untuk Laravel biasanya:</span>
		<code class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere"
			>{LARAVEL_RELEASE_COMMAND}</code
		>
	</p>
	<a
		href={RELEASE_COMMAND_DOCS_URL}
		target="_blank"
		rel="noreferrer noopener"
		class="inline-flex min-h-6 items-center gap-1 self-start text-sm font-medium text-primary-dark underline underline-offset-2"
	>
		{DATABASE_COPY.releaseDocs}
		<ArrowSquareOut size={14} aria-hidden="true" />
		<span class="sr-only">(tab baru)</span>
	</a>
</section>
