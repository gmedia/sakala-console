<script lang="ts">
	import Check from 'phosphor-svelte/lib/Check';
	import Copy from 'phosphor-svelte/lib/Copy';
	import Button from '$lib/components/ui/Button.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';

	type Props = {
		label: string;
		/** `undefined` while hidden; `null` when the API has no value yet. */
		value: string | null | undefined;
		missingText?: string;
	};

	let { label, value, missingText = 'Belum ada' }: Props = $props();

	/** How long the check mark replaces the copy icon; the toast already said it worked. */
	const COPIED_FEEDBACK_MS = 2000;

	let copied = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		if (!value) return;
		const ok = await copyWithToast(value, {
			success: `${label} disalin.`,
			failure: `Browser menolak akses clipboard. Salin ${label} secara manual.`
		});
		if (!ok) return;
		copied = true;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copied = false), COPIED_FEEDBACK_MS);
	}
</script>

<div
	class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] lg:py-1"
>
	<dt class="text-xs font-medium text-muted sm:text-sm">{label}</dt>
	<dd
		class="col-span-2 row-start-2 min-w-0 font-mono text-sm wrap-anywhere text-foreground sm:col-span-1 sm:col-start-2 sm:row-start-1"
	>
		{#if value === undefined}
			<span class="text-muted select-none" role="img" aria-label="Disembunyikan">••••••••••••</span>
		{:else if value === null}
			<span class="font-sans text-muted">{missingText}</span>
		{:else}
			<span class="select-all">{value}</span>
		{/if}
	</dd>
	{#if value}
		<Button
			variant="ghost"
			size="sm"
			class="col-start-2 row-start-1 sm:col-start-3"
			onclick={copy}
			aria-label={`Salin ${label}`}
		>
			{#if copied}
				<Check size={16} class="text-success" aria-hidden="true" />
			{:else}
				<Copy size={16} aria-hidden="true" />
			{/if}
		</Button>
	{/if}
</div>
