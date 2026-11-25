<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Button from '$lib/components/ui/Button.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';
	import { APEX_HOST } from '../names';
	import { DOMAIN_COPY } from '../presentation';
	import type { DnsRecordRow } from '../records';

	type Props = {
		records: DnsRecordRow[];
		/** The zone the names are relative to; `null` when the names are shown in full. */
		zone: string | null;
	};

	let { records, zone }: Props = $props();

	/** How long the check mark replaces the copy icon; the toast already said it worked. */
	const COPIED_FEEDBACK_MS = 2000;

	let copiedKey = $state<string | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy(key: string, text: string, what: string) {
		const ok = await copyWithToast(text, {
			success: `${what} disalin.`,
			failure: `Browser menolak akses clipboard. Salin ${what} secara manual.`
		});
		if (!ok) return;
		copiedKey = key;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copiedKey = null), COPIED_FEEDBACK_MS);
	}

	// Shown once below the steps, and only when the names are relative to a zone.
	const relative = $derived(
		zone !== null && records.some((record) => record.host !== record.fullName)
	);
</script>

{#snippet field(key: string, label: string, text: string, what: string)}
	<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
		<dt class="col-start-1 text-xs text-muted sm:sr-only">{label}</dt>
		<dd class="col-start-1 flex min-w-0 items-baseline gap-3">
			<span class="hidden w-10 shrink-0 text-xs text-muted sm:inline" aria-hidden="true"
				>{label}</span
			>
			<span class="min-w-0 font-mono text-sm wrap-anywhere text-foreground select-all">{text}</span>
		</dd>
		<div class="col-start-2 row-span-2 row-start-1 self-center sm:row-span-1">
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={() => copy(key, text, what)}
				aria-label={`Salin ${what}`}
				title={`Salin ${what}`}
			>
				{#if copiedKey === key}
					<Check size={16} class="text-success" aria-hidden="true" />
				{:else}
					<Copy size={16} aria-hidden="true" />
				{/if}
			</Button>
		</div>
	</div>
{/snippet}

<ol class="flex flex-col gap-2" data-testid="dns-records">
	{#each records as record, index (record.type + record.fullName)}
		<li
			class="flex flex-col gap-1.5 rounded-control border border-border p-3"
			data-testid="dns-record"
		>
			<p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
				<span
					class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-dark"
					aria-hidden="true">{index + 1}</span
				>
				<span class="sr-only">Langkah {index + 1}:</span>
				<span class="font-mono font-semibold text-foreground">{record.type}</span>
				<span class="text-muted">{record.tag}</span>
			</p>
			<dl class="flex flex-col gap-1.5 sm:gap-0.5">
				{@render field(`${index}-name`, DOMAIN_COPY.recordName, record.host, `nama ${record.type}`)}
				{@render field(
					`${index}-value`,
					DOMAIN_COPY.recordValue,
					record.value,
					`nilai ${record.type}`
				)}
			</dl>
			{#if record.hint}
				<p class="text-xs text-muted">{record.hint}</p>
			{/if}
		</li>
	{/each}
</ol>
{#if relative && zone}
	<p class="text-xs wrap-anywhere text-muted">
		{records.some((record) => record.host === APEX_HOST)
			? DOMAIN_COPY.apexNameHint(zone)
			: DOMAIN_COPY.fullNameHint(zone)}
	</p>
{/if}
