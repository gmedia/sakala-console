<script lang="ts">
	// The guide is a page on the landing site, outside this app's routes.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Lightbulb from 'phosphor-svelte/lib/Lightbulb';
	import { bucketGuideUrl } from '$lib/config/project';
	import { BUCKET_COPY } from '../presentation';
	import { LARAVEL_FILESYSTEM_DISK } from '../variables';
</script>

<section
	class="surface-card flex min-w-0 flex-col gap-3 p-4 sm:p-5"
	aria-labelledby="bucket-usage-title"
	data-testid="bucket-usage-hint"
>
	<h2 id="bucket-usage-title" class="flex items-center gap-2 text-base text-foreground">
		<Lightbulb size={18} class="shrink-0 text-primary-dark" aria-hidden="true" />
		Cara memakai bucket
	</h2>
	<p class="text-sm text-muted">{BUCKET_COPY.privateNote}</p>
	<p class="flex flex-col gap-1 text-sm text-foreground">
		<span>Untuk Laravel, tambahkan variabel proyek:</span>
		<code class="rounded-control bg-background-soft px-2 py-1 font-mono text-xs wrap-anywhere"
			>{LARAVEL_FILESYSTEM_DISK.key}={LARAVEL_FILESYSTEM_DISK.value}</code
		>
		<span class="text-muted">
			Sakala tidak mengisinya sendiri, supaya berkas yang memang disimpan lokal tidak ikut pindah.
		</span>
	</p>
	<p class="text-sm text-muted">{BUCKET_COPY.backupNote}</p>
	<a
		href={bucketGuideUrl()}
		target="_blank"
		rel="noreferrer noopener"
		class="inline-flex min-h-6 items-center gap-1 self-start text-sm font-medium text-primary-dark underline underline-offset-2"
	>
		{BUCKET_COPY.guideLink}
		<ArrowSquareOut size={14} aria-hidden="true" />
		<span class="sr-only">(tab baru)</span>
	</a>
</section>
