<script lang="ts">
	// The create link carries the project in the query string, which resolve() cannot express.
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { untrack } from 'svelte';
	import type { ValkeyAttachment } from '$lib/api/resources/valkeys';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { createAttachValkeyMutation } from '../mutations';
	import { formatMegabytes, valkeyErrorMessage, valkeyStatusView } from '../presentation';
	import { createValkeysQuery } from '../queries';
	import { newValkeyHref } from '../routes';
	import ValkeyModeLabel from './ValkeyModeLabel.svelte';

	type Props = {
		open: boolean;
		workspaceId: string;
		project: { id: string; name: string };
		/** The workspace may still create a store, so the dialog offers one for this project. */
		canCreate: boolean;
		returnFocus?: () => HTMLElement | null | undefined;
		onAttached: (attachment: ValkeyAttachment) => void;
	};

	let {
		open = $bindable(false),
		workspaceId,
		project,
		canCreate,
		returnFocus,
		onAttached
	}: Props = $props();

	const valkeysQuery = createValkeysQuery(
		() => workspaceId,
		() => ({ enabled: open })
	);
	const attachMutation = createAttachValkeyMutation();

	let selectedId = $state<string | null>(null);
	let formError = $state<string | null>(null);

	const valkeys = $derived(valkeysQuery.data ?? []);

	// Only opening resets the choice; a refetch while it is open must not.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			selectedId = null;
			formError = null;
		});
	});

	/** Why a store cannot be chosen, beside it; a ready store has none. */
	function unavailableReason(valkey: (typeof valkeys)[number]): string | null {
		return valkey.status === 'ready' ? null : valkeyStatusView(valkey).label;
	}

	async function attach() {
		formError = null;
		if (!selectedId) {
			formError = 'Pilih Valkey yang akan dipakai proyek ini.';
			return;
		}
		try {
			const attachment = await attachMutation.mutateAsync({
				workspaceId,
				valkeyId: selectedId,
				projectId: project.id
			});
			open = false;
			onAttached(attachment);
		} catch (error) {
			formError = valkeyErrorMessage(
				error,
				'attach',
				'Valkey belum terpasang. Muat ulang halaman, lalu pasang lagi.'
			);
		}
	}
</script>

<Dialog
	bind:open
	title="Pasang Valkey"
	class="max-w-lg"
	descriptionClass="text-muted"
	confirmLabel={attachMutation.isPending ? 'Memasang...' : 'Pasang Valkey'}
	loading={attachMutation.isPending}
	confirmDisabled={valkeys.length === 0}
	{returnFocus}
	onConfirm={attach}
>
	{#snippet description()}
		<span class="font-medium wrap-anywhere text-foreground">{project.name}</span> tersambung ke
		Valkey yang dipilih dan menerima <code class="font-mono text-xs text-foreground">REDIS_*</code> saat
		deploy berikutnya. Valkey hanya bisa dipakai proyek di server yang sama.
	{/snippet}

	<div class="flex flex-col gap-3" data-testid="attach-project-valkey-dialog">
		<fieldset class="flex min-w-0 flex-col gap-2">
			<legend class="mb-1 text-sm font-medium text-foreground">Valkey di workspace ini</legend>
			{#if valkeysQuery.isPending}
				<div class="skeleton h-28 w-full" role="status" aria-label="Memuat Valkey"></div>
			{:else if valkeysQuery.isError}
				<p class="text-sm text-error-dark" role="alert">
					Daftar Valkey belum bisa dimuat. Tutup lalu buka lagi dialog ini.
				</p>
			{:else if valkeys.length === 0}
				<p class="text-sm text-muted">Workspace ini belum punya Valkey.</p>
			{:else}
				<ul class="flex flex-col gap-1.5">
					{#each valkeys as valkey (valkey.id)}
						{@const reason = unavailableReason(valkey)}
						<li>
							<label
								class="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-control border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary-50 has-disabled:cursor-not-allowed has-disabled:bg-background-soft {reason
									? 'border-border'
									: 'border-border-strong'}"
							>
								<input
									type="radio"
									name="attach-project-valkey"
									value={valkey.id}
									bind:group={selectedId}
									disabled={Boolean(reason)}
									class="size-4 shrink-0"
								/>
								<span class="min-w-0 flex-1 font-mono font-medium wrap-anywhere text-foreground"
									>{valkey.name}</span
								>
								<span class="flex shrink-0 items-center gap-1.5">
									<ValkeyModeLabel mode={valkey.mode} />
									<span class="text-xs text-muted tabular-nums"
										>{formatMegabytes(valkey.maxmemory_mb)}</span
									>
									{#if reason}
										<span class="text-xs text-muted">{reason}</span>
									{/if}
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
		</fieldset>

		{#if canCreate}
			<p class="text-sm text-muted">
				Atau
				<a
					href={newValkeyHref({ projectId: project.id })}
					class="inline-flex min-h-6 items-center font-medium text-primary-dark underline underline-offset-2"
					data-testid="attach-dialog-create-valkey">buat Valkey baru untuk proyek ini</a
				>, yang langsung ditempatkan di server proyeknya.
			</p>
		{/if}

		{#if formError}
			<p
				role="alert"
				class="rounded-control border border-error/20 bg-error/10 px-3 py-2 text-sm text-foreground"
				data-testid="attach-project-valkey-error"
			>
				{formError}
			</p>
		{/if}
	</div>
</Dialog>
