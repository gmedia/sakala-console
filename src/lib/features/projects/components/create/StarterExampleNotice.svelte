<script lang="ts">
	import FlaskIcon from 'phosphor-svelte/lib/FlaskIcon';
	import type { StarterExample } from '$lib/config/starter-examples';
	import { normalizeGithubRepositoryUrl } from '../../validation/repositoryUrl';

	let { example }: { example: StarterExample } = $props();

	const repository = $derived.by(() => {
		const parsed = normalizeGithubRepositoryUrl(example.repository);
		return parsed.ok ? parsed.fullName : example.repository;
	});
</script>

<div
	class="flex items-start gap-3 rounded-control border border-primary/30 bg-primary-50 p-3 text-sm text-foreground"
	data-testid="starter-example-notice"
>
	<FlaskIcon class="mt-0.5 size-5 shrink-0 text-primary-dark" aria-hidden="true" />
	<div class="min-w-0 space-y-1">
		<p>
			Kamu memakai contoh <span class="font-semibold">{example.label}</span> dari
			<span class="font-mono wrap-anywhere">{repository}</span>, folder
			<span class="font-mono">{example.rootDirectory}</span>.
		</p>
		{#each example.env as env (env.key)}
			<p><span class="font-mono font-medium">{env.key}</span>: {env.hint}</p>
		{/each}
		{#each example.optionalEnv as env (env.key)}
			<p>
				<span class="font-mono font-medium">{env.key}</span> (opsional): {env.hint}
			</p>
		{/each}
		<p class="text-foreground/70">
			Mau mengubah kodenya? Fork repo ini di GitHub, lalu buat proyek dari fork-mu supaya
			auto-deploy aktif.
		</p>
	</div>
</div>
