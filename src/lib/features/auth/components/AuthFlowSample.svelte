<script lang="ts">
	/**
	 * The path one deployment takes, drawn in CSS and labelled as a sample. The values are not from a
	 * real project, and the stage names are the ones the deployment timeline uses.
	 */
	const stages = [
		{ label: 'Repository', value: 'kamu/toko-kopi, branch main' },
		{ label: 'Build', value: 'pnpm build' },
		{ label: 'Health check', value: 'aplikasi menjawab di port 3000' },
		{ label: 'URL publik', value: 'toko-kopi.example.test' }
	];
</script>

<figure class="rounded-card bg-primary-800 p-5 text-white">
	<figcaption class="flex items-center justify-between gap-3 text-sm">
		<span>Alur satu deployment</span>
		<span class="rounded-full border border-white px-2 font-mono text-xs">contoh</span>
	</figcaption>
	<ol class="mt-4">
		{#each stages as stage, index (stage.label)}
			<li class="relative flex gap-3 pb-3 last:pb-0">
				{#if index < stages.length - 1}
					<span class="absolute top-3 bottom-0 left-1 w-px bg-primary-300" aria-hidden="true"
					></span>
				{/if}
				<span class="mt-1.5 size-2.5 shrink-0 rounded-full bg-primary-100" aria-hidden="true"
				></span>
				<span class="flex min-w-0 flex-wrap items-baseline gap-x-3">
					<span class="w-28 shrink-0 text-sm font-medium">{stage.label}</span>
					<span class="min-w-0 font-mono text-sm wrap-anywhere text-primary-100">{stage.value}</span
					>
				</span>
			</li>
		{/each}
	</ol>
</figure>
