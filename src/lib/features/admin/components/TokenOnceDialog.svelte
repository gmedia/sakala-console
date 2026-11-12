<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import Copy from 'phosphor-svelte/lib/Copy';
	import WarningIcon from 'phosphor-svelte/lib/WarningIcon';
	import Button from '$lib/components/ui/Button.svelte';
	import { copyWithToast } from '$lib/utils/clipboard';

	type Props = {
		open: boolean;
		token: string;
		agentId: string;
		agentName: string;
		/** Where this console's API lives, for `SAKALA_API_URL`. */
		apiUrl: string;
		/** A rotation also says that the old token already stopped working. */
		rotated?: boolean;
		/** Called once the admin confirmed and closed; the caller forgets the token then. */
		onDone: () => void;
	};

	let {
		open = $bindable(),
		token,
		agentId,
		agentName,
		apiUrl,
		rotated = false,
		onDone
	}: Props = $props();

	let saved = $state(false);
	let triedClosing = $state(false);
	let copyButton = $state<HTMLElement | null>(null);
	let savedCheckbox = $state<HTMLInputElement | null>(null);

	$effect.pre(() => {
		if (open) {
			saved = false;
			triedClosing = false;
		}
	});

	const envBlock = $derived(
		[`SAKALA_API_URL=${apiUrl}`, `SAKALA_AGENT_ID=${agentId}`, `SAKALA_AGENT_TOKEN=${token}`].join(
			'\n'
		)
	);

	// Closing is only possible once the admin said the token is saved: the API keeps a hash, so
	// a token closed away unsaved can only be replaced by rotating again.
	// The button stays enabled so it can say why it refuses, instead of sitting there greyed out.
	function close() {
		if (!saved) {
			triedClosing = true;
			savedCheckbox?.focus();
			return;
		}
		open = false;
		onDone();
	}

	const COPY = {
		success: 'Disalin. Simpan di tempat yang aman.',
		failure: 'Browser menolak akses clipboard. Pilih teksnya lalu salin manual.'
	};
</script>

<DialogPrimitive.Root
	bind:open={
		() => open,
		(next) => {
			if (!next) close();
		}
	}
>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay class="fixed inset-0 z-50 bg-scrim/50" />
		<DialogPrimitive.Content
			escapeKeydownBehavior={saved ? 'close' : 'ignore'}
			interactOutsideBehavior="ignore"
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				copyButton?.focus();
			}}
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-overlay border border-border bg-surface p-6 shadow-overlay"
		>
			<DialogPrimitive.Title
				class="font-display text-xl font-semibold wrap-anywhere text-foreground"
			>
				Token untuk {agentName}
			</DialogPrimitive.Title>

			<div
				class="mt-4 flex gap-3 rounded-control border border-warning/30 bg-accent-soft p-4 text-warning-dark"
			>
				<WarningIcon size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
				<DialogPrimitive.Description class="text-sm">
					<strong class="block text-foreground">Token ini hanya ditampilkan sekali</strong>
					Simpan sekarang. Setelah jendela ini ditutup, token tidak bisa dilihat lagi; yang bisa dilakukan
					hanya membuat token baru.
					{#if rotated}Token lama node ini sudah tidak berlaku.{/if}
				</DialogPrimitive.Description>
			</div>

			<div class="mt-4 space-y-1.5">
				<p id="agent-token-label" class="text-sm font-medium text-foreground">Token agent</p>
				<div class="flex items-center gap-2 rounded-control bg-terminal p-2 pl-3">
					<code
						aria-labelledby="agent-token-label"
						class="min-w-0 flex-1 font-mono text-sm break-all text-terminal-text select-all"
						data-testid="agent-token">{token}</code
					>
					<Button
						bind:ref={copyButton}
						variant="terminal"
						size="icon-sm"
						aria-label="Salin token"
						onclick={() => copyWithToast(token, COPY)}
					>
						<Copy size={16} aria-hidden="true" />
					</Button>
				</div>
			</div>

			<div class="mt-4 space-y-1.5">
				<div class="flex items-center justify-between gap-2">
					<p id="agent-env-label" class="text-sm font-medium text-foreground">
						Environment variable untuk sakala-agent
					</p>
					<Button variant="link" onclick={() => copyWithToast(envBlock, COPY)}>Salin semua</Button>
				</div>
				<pre
					aria-labelledby="agent-env-label"
					class="overflow-x-auto rounded-control border border-border bg-background-soft p-3 font-mono text-xs text-foreground">{envBlock}</pre>
				<p class="text-xs text-muted">
					Agent memakai token ini untuk setiap request. Statusnya berubah setelah heartbeat pertama.
				</p>
			</div>

			<label class="mt-5 flex cursor-pointer items-start gap-3 text-sm font-medium text-foreground">
				<input
					type="checkbox"
					class="mt-0.5 size-5"
					bind:this={savedCheckbox}
					bind:checked={saved}
					aria-invalid={triedClosing && !saved ? 'true' : undefined}
					aria-describedby="agent-token-close-hint"
				/>
				Saya sudah menyimpan token ini
			</label>
			<p
				id="agent-token-close-hint"
				class="mt-2 text-xs {triedClosing && !saved ? 'text-error-base' : 'text-foreground/70'}"
				role={triedClosing && !saved ? 'alert' : undefined}
			>
				{#if saved}
					Token tidak bisa ditampilkan lagi setelah dialog ini ditutup.
				{:else}
					Centang dulu kotak di atas. Setelah dialog ditutup, token ini tidak bisa ditampilkan lagi;
					kalau hilang, kamu harus membuat token baru.
				{/if}
			</p>

			<Button
				class="mt-4 w-full"
				size="lg"
				aria-describedby="agent-token-close-hint"
				onclick={close}>Tutup</Button
			>
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>
