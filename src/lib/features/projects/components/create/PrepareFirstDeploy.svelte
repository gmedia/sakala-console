<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import EnvSuggestionList from '../../env-suggestions/EnvSuggestionList.svelte';
	import { SUGGESTION_COPY } from '../../env-suggestions/presentation';
	import { WAITING_COPY } from '../../first-deploy/deploy-when-ready';
	import type { FirstDeploySetup } from '../../first-deploy/use-first-deploy-setup.svelte';
	import DatabaseChoiceCard from './DatabaseChoiceCard.svelte';
	import EnvFailureList from './EnvFailureList.svelte';

	/**
	 * The Persiapan phase of the first deploy: the database decision, then the variables. Only the
	 * radio group and the "Perlu kamu isi" inputs are open; everything Sakala prepared itself sits in
	 * closed groups with counts (Hick's Law, Miller's Law, Tesler's Law).
	 */
	type Props = { setup: FirstDeploySetup };

	let { setup }: Props = $props();

	const busy = $derived(setup.phase === 'running');
	const suggestions = $derived(setup.suggestions);
	const showVariables = $derived(
		suggestions !== null && (suggestions.rows.length > 0 || suggestions.alreadySet.length > 0)
	);
</script>

<div class="flex flex-col gap-4" data-testid="prepare-first-deploy">
	{#if setup.attached}
		<p class="rounded-card border border-border bg-surface p-4 text-sm">
			Proyek ini memakai database <span class="font-mono font-medium">{setup.attached.name}</span>.
			Variabel koneksinya diisi Sakala saat deploy.
		</p>
	{:else}
		<DatabaseChoiceCard {setup} disabled={busy} />
	{/if}

	{#if setup.failure}
		<div
			class="flex flex-col gap-2 rounded-control border border-error/30 bg-error/10 p-3 text-sm"
			role="alert"
		>
			<p>{setup.failure.message}</p>
			{#if setup.failure.offerWithoutDatabase}
				<Button
					variant="secondary"
					class="self-start"
					disabled={busy}
					onclick={() => setup.deployWithoutDatabase()}
				>
					{WAITING_COPY.withoutDatabase}
				</Button>
			{/if}
		</div>
	{/if}

	{#if setup.phase === 'variables-failed'}
		<section class="flex flex-col gap-2" aria-labelledby="first-deploy-env-failures">
			<h3 id="first-deploy-env-failures" class="font-sans text-base font-semibold" role="alert">
				{setup.envFailures.length} variabel belum tersimpan, jadi deploy belum dimulai
			</h3>
			<p class="text-sm">
				Perbaiki yang di bawah lalu simpan ulang, atau lanjut tanpa variabel ini. Yang lain sudah
				tersimpan.
			</p>
			<EnvFailureList failures={setup.envFailures} />
		</section>
	{:else if showVariables && suggestions}
		<section
			class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4"
			aria-labelledby="first-deploy-env-title"
		>
			<h3 id="first-deploy-env-title" class="font-sans text-base font-semibold">
				{SUGGESTION_COPY.sectionTitle}
			</h3>
			<EnvSuggestionList
				rows={suggestions.rows}
				draft={setup.draft}
				alreadySet={suggestions.alreadySet}
				onEdit={(key, change) => setup.editRow(key, change)}
				disabled={busy}
				truncated={setup.truncated}
			/>
		</section>
	{/if}
</div>
